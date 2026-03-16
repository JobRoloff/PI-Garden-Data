"""
FastAPI Web API with WebSocket streaming for PI Garden Dashboard.
Streams: current sensor readings, actuator changes, recent event feed, connection status.
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Load .env from project root and service dir
_root = Path(__file__).resolve().parent.parent.parent
for _d in (_root, Path(__file__).resolve().parent):
    _env = _d / ".env"
    if _env.is_file():
        load_dotenv(_env)
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
POLL_INTERVAL_SEC = float(os.getenv("WS_POLL_INTERVAL_SEC", "2"))
EVENT_FEED_LIMIT = int(os.getenv("WS_EVENT_FEED_LIMIT", "50"))

# All connected WebSocket clients
connections: set[WebSocket] = set()


def get_db_connection():
    """Sync connection for polling from background task."""
    if not DATABASE_URL:
        return None
    try:
        return psycopg.connect(DATABASE_URL)
    except Exception:
        return None


def fetch_latest_sensor_readings(conn: psycopg.Connection | None) -> dict[str, Any]:
    """Latest 'latest' (sensor readings) per topic from most recent mqtt_summary row."""
    if not conn:
        return {}
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT topic, latest
                FROM mqtt_summary
                ORDER BY ts DESC
                LIMIT 20
                """
            )
            rows = cur.fetchall()
        return {row[0]: row[1] for row in rows} if rows else {}
    except Exception:
        return {}


def fetch_recent_actuator_events(conn: psycopg.Connection | None) -> list[dict[str, Any]]:
    """Recent actuator_event items from mqtt_points.points."""
    if not conn:
        return []
    out: list[dict[str, Any]] = []
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ts, topic, report_ts, points
                FROM mqtt_points
                ORDER BY ts DESC
                LIMIT 20
                """
            )
            for row in cur.fetchall():
                ts, topic, report_ts, points = row
                if not isinstance(points, list):
                    continue
                for p in points:
                    if isinstance(p, dict) and p.get("kind") == "actuator_event":
                        out.append({
                            "ts": str(ts) if ts else None,
                            "topic": topic,
                            "report_ts": report_ts,
                            **{k: v for k, v in p.items() if k != "kind"},
                        })
        return out[:50]
    except Exception:
        return []


def fetch_recent_event_feed(conn: psycopg.Connection | None) -> list[dict[str, Any]]:
    """Recent events: summary rows and point events (sensor_reading + actuator_event) merged by time."""
    if not conn:
        return []
    events: list[tuple[float, str, dict[str, Any]]] = []
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ts, topic, report_ts, latest, rollups, control
                FROM mqtt_summary
                ORDER BY ts DESC
                LIMIT 15
                """
            )
            for row in cur.fetchall():
                ts, topic, report_ts, latest, rollups, control = row
                t = ts.timestamp() if hasattr(ts, "timestamp") else (ts or 0)
                events.append((t, "summary", {"ts": str(ts), "topic": topic, "report_ts": report_ts, "latest": latest, "rollups": rollups, "control": control}))
            cur.execute(
                """
                SELECT ts, topic, report_ts, points
                FROM mqtt_points
                ORDER BY ts DESC
                LIMIT 15
                """
            )
            for row in cur.fetchall():
                ts, topic, report_ts, points = row
                t = ts.timestamp() if ts and hasattr(ts, "timestamp") else (report_ts or 0)
                if not isinstance(points, list):
                    continue
                for p in points:
                    if isinstance(p, dict) and p.get("kind") in ("sensor_reading", "actuator_event"):
                        events.append((t, p.get("kind", "point"), {"ts": str(ts), "topic": topic, **p}))
        events.sort(key=lambda x: -x[0])
        return [e[2] for e in events[:EVENT_FEED_LIMIT]]
    except Exception:
        return []


# Max summary rows for 24h chart (e.g. ~5 min interval = 288)
CHART_24H_LIMIT = int(os.getenv("WS_CHART_24H_LIMIT", "500"))
# Max mqtt_points rows to scan for 24h light spectrum chart
LIGHT_POINTS_24H_LIMIT = int(os.getenv("WS_LIGHT_POINTS_24H_LIMIT", "500"))
# Max mqtt_points rows to scan for 24h scalar (temp/humidity) chart
SCALAR_POINTS_24H_LIMIT = int(os.getenv("WS_SCALAR_POINTS_24H_LIMIT", "500"))


def fetch_chart_data_24h(conn: psycopg.Connection | None) -> list[dict[str, Any]]:
    """Summary rows from the last 24 hours for temperature/humidity charts (chronological).
    If the 24h window has no rows, returns the most recent N rows so the chart still has data.
    """
    if not conn:
        return []
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ts, topic, report_ts, latest, rollups, control
                FROM mqtt_summary
                WHERE ts >= now() - interval '24 hours'
                ORDER BY ts ASC
                LIMIT %s
                """,
                (CHART_24H_LIMIT,),
            )
            rows = cur.fetchall()
            if not rows:
                # No rows in 24h window: use last N rows by time so chart still has multiple points
                cur.execute(
                    """
                    SELECT ts, topic, report_ts, latest, rollups, control
                    FROM mqtt_summary
                    ORDER BY ts DESC
                    LIMIT %s
                    """,
                    (CHART_24H_LIMIT,),
                )
                rows = list(reversed(cur.fetchall()))
            out: list[dict[str, Any]] = []
            for row in rows:
                ts, topic, report_ts, latest, rollups, control = row
                out.append({
                    "ts": str(ts),
                    "topic": topic,
                    "report_ts": report_ts,
                    "latest": latest,
                    "rollups": rollups,
                    "control": control,
                })
            return out
    except Exception:
        return []


def fetch_light_points_24h(conn: psycopg.Connection | None) -> list[dict[str, Any]]:
    """Flattened light spectrum sensor_reading events (AS7341Module/light) from last 24h.

    Returns point-level events similar to event_feed, but focused on light spectrum and
    covering a full 24h window so the frontend can render a dense light chart.
    """
    if not conn:
        return []
    events: list[tuple[float, dict[str, Any]]] = []
    try:
        with conn.cursor() as cur:
            # Prefer rows within 24h window; if none, fall back to the last N rows
            cur.execute(
                """
                SELECT ts, topic, report_ts, points
                FROM mqtt_points
                WHERE ts >= now() - interval '24 hours'
                ORDER BY ts ASC
                LIMIT %s
                """,
                (LIGHT_POINTS_24H_LIMIT,),
            )
            rows = cur.fetchall()
            if not rows:
                cur.execute(
                    """
                    SELECT ts, topic, report_ts, points
                    FROM mqtt_points
                    ORDER BY ts DESC
                    LIMIT %s
                    """,
                    (LIGHT_POINTS_24H_LIMIT,),
                )
                rows = list(reversed(cur.fetchall()))

            for row in rows:
                ts, topic, report_ts, points = row
                base_ts = ts.timestamp() if ts and hasattr(ts, "timestamp") else (report_ts or 0)
                if not isinstance(points, list):
                    continue
                for p in points:
                    if not isinstance(p, dict):
                        continue
                    if p.get("kind") != "sensor_reading":
                        continue
                    if not (
                        p.get("sensor_type") == "AS7341Module"
                        or p.get("sensor_id") == "light"
                    ):
                        continue
                    # Use point-level timestamp if present; fall back to row/report_ts
                    ts_val = p.get("timestamp")
                    if isinstance(ts_val, (int, float)):
                        t_key = float(ts_val)
                    elif isinstance(ts_val, str):
                        try:
                            t_key = float(ts_val)
                        except ValueError:
                            t_key = float(base_ts)
                    else:
                        t_key = float(base_ts)
                    events.append(
                        (
                            t_key,
                            {
                                "ts": str(ts) if ts else None,
                                "topic": topic,
                                "report_ts": report_ts,
                                **p,
                            },
                        )
                    )
        # Sort chronologically by point timestamp
        events.sort(key=lambda x: x[0])
        return [e[1] for e in events]
    except Exception:
        return []


def fetch_scalar_points_24h(conn: psycopg.Connection | None) -> list[dict[str, Any]]:
    """Flattened scalar sensor_reading events (e.g. DHT22 temp/humidity) from last 24h.

    This is used by the frontend to build 24h temperature and humidity charts
    directly from mqtt_points, independent of mqtt_summary.latest structure.
    """
    if not conn:
        return []
    events: list[tuple[float, dict[str, Any]]] = []
    try:
        with conn.cursor() as cur:
            # Prefer rows within 24h window; if none, fall back to the last N rows
            cur.execute(
                """
                SELECT ts, topic, report_ts, points
                FROM mqtt_points
                WHERE ts >= now() - interval '24 hours'
                ORDER BY ts ASC
                LIMIT %s
                """,
                (SCALAR_POINTS_24H_LIMIT,),
            )
            rows = cur.fetchall()
            if not rows:
                cur.execute(
                    """
                    SELECT ts, topic, report_ts, points
                    FROM mqtt_points
                    ORDER BY ts DESC
                    LIMIT %s
                    """,
                    (SCALAR_POINTS_24H_LIMIT,),
                )
                rows = list(reversed(cur.fetchall()))

            for row in rows:
                ts, topic, report_ts, points = row
                base_ts = ts.timestamp() if ts and hasattr(ts, "timestamp") else (report_ts or 0)
                if not isinstance(points, list):
                    continue
                for p in points:
                    if not isinstance(p, dict):
                        continue
                    if p.get("kind") != "sensor_reading":
                        continue
                    # For now, focus on DHT22 env sensor; extend as needed
                    if not (
                        p.get("sensor_type") == "DHT22"
                        or p.get("sensor_id") == "DHT22"
                    ):
                        continue
                    ts_val = p.get("timestamp")
                    if isinstance(ts_val, (int, float)):
                        t_key = float(ts_val)
                    elif isinstance(ts_val, str):
                        try:
                            t_key = float(ts_val)
                        except ValueError:
                            t_key = float(base_ts)
                    else:
                        t_key = float(base_ts)
                    events.append(
                        (
                            t_key,
                            {
                                "ts": str(ts) if ts else None,
                                "topic": topic,
                                "report_ts": report_ts,
                                **p,
                            },
                        )
                    )
        events.sort(key=lambda x: x[0])
        return [e[1] for e in events]
    except Exception:
        return []


async def broadcast(message: dict[str, Any]) -> None:
    """Send JSON message to all connected WebSocket clients."""
    payload = json.dumps(message)
    dead: set[WebSocket] = set()
    for ws in connections:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    for ws in dead:
        connections.discard(ws)


async def poll_and_broadcast() -> None:
    """Background task: poll DB and broadcast sensor_readings, actuator_change, event_feed, connection_status."""
    while True:
        conn = get_db_connection()
        status: dict[str, Any] = {
            "connected": conn is not None,
            "database_ok": conn is not None,
        }
        if conn:
            try:
                with conn:
                    await broadcast({"type": "connection_status", "payload": status})
                    readings = fetch_latest_sensor_readings(conn)
                    await broadcast({"type": "sensor_readings", "payload": readings})
                    actuators = fetch_recent_actuator_events(conn)
                    if actuators:
                        await broadcast({"type": "actuator_change", "payload": actuators})
                    feed = fetch_recent_event_feed(conn)
                    await broadcast({"type": "event_feed", "payload": feed})
                    chart_24h = fetch_chart_data_24h(conn)
                    await broadcast({"type": "chart_24h", "payload": chart_24h})
                    light_points_24h = fetch_light_points_24h(conn)
                    if light_points_24h:
                        await broadcast({"type": "light_points_24h", "payload": light_points_24h})
                    scalar_points_24h = fetch_scalar_points_24h(conn)
                    if scalar_points_24h:
                        await broadcast({"type": "scalar_points_24h", "payload": scalar_points_24h})
            except Exception:
                status["database_ok"] = False
                await broadcast({"type": "connection_status", "payload": status})
            finally:
                try:
                    conn.close()
                except Exception:
                    pass
        else:
            await broadcast({"type": "connection_status", "payload": status})
        await asyncio.sleep(POLL_INTERVAL_SEC)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(poll_and_broadcast())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="PI Garden Web API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/chart-24h")
def chart_24h():
    """Return summary rows from the last 24 hours for dashboard charts (same as WebSocket chart_24h payload)."""
    conn = get_db_connection()
    if not conn:
        return []
    try:
        return fetch_chart_data_24h(conn)
    finally:
        try:
            conn.close()
        except Exception:
            pass


@app.get("/light-points-24h")
def light_points_24h():
    """Return light spectrum sensor_reading events for last 24 hours (AS7341Module/light)."""
    conn = get_db_connection()
    if not conn:
        return []
    try:
        return fetch_light_points_24h(conn)
    finally:
        try:
            conn.close()
        except Exception:
            pass


@app.get("/scalar-points-24h")
def scalar_points_24h():
    """Return scalar sensor_reading events (e.g. DHT22 temp/humidity) for last 24 hours."""
    conn = get_db_connection()
    if not conn:
        return []
    try:
        return fetch_scalar_points_24h(conn)
    finally:
        try:
            conn.close()
        except Exception:
            pass


@app.websocket("/ws")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    connections.add(websocket)
    try:
        await websocket.send_text(
            json.dumps({"type": "connection_status", "payload": {"connected": True, "stream": "ready"}})
        )
        while True:
            # Wait for client message or disconnect; optional ping/pong
            data = await asyncio.wait_for(websocket.receive_text(), timeout=60.0)
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "payload": {}}))
            except json.JSONDecodeError:
                pass
    except asyncio.TimeoutError:
        # Keep connection in set; next broadcast will fail if disconnected
        pass
    except WebSocketDisconnect:
        connections.discard(websocket)
    except Exception:
        connections.discard(websocket)
    finally:
        connections.discard(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
