import os
import psycopg
from psycopg_pool import ConnectionPool

from typing import Any;
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root and service dir
_root = Path(__file__).resolve().parent.parent.parent
for _d in (_root, Path(__file__).resolve().parent):
    _env = _d / ".env"
    if _env.is_file():
        load_dotenv(_env)
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# Max summary rows for 24h chart (e.g. ~5 min interval = 288)
CHART_24H_LIMIT = int(os.getenv("WS_CHART_24H_LIMIT", "500"))
EVENT_FEED_LIMIT = int(os.getenv("WS_EVENT_FEED_LIMIT", "50"))
# Max mqtt_points rows to scan for 24h light spectrum chart
LIGHT_POINTS_24H_LIMIT = int(os.getenv("WS_LIGHT_POINTS_24H_LIMIT", "500"))
# Max mqtt_points rows to scan for 24h scalar (temp/humidity) chart
SCALAR_POINTS_24H_LIMIT = int(os.getenv("WS_SCALAR_POINTS_24H_LIMIT", "500"))


_pool: ConnectionPool | None = None


def init_pool(min_size: int = 1, max_size: int = 10) -> ConnectionPool | None:
    """Create the global connection pool. Call once at app startup."""
    global _pool
    if not DATABASE_URL:
        return None
    try:
        _pool = ConnectionPool(
            DATABASE_URL,
            min_size=min_size,
            max_size=max_size,
        )
        return _pool
    except Exception:
        _pool = None
        return None


def close_pool() -> None:
    """Close the global connection pool. Call at app shutdown."""
    global _pool
    if _pool is not None:
        try:
            _pool.close()
        except Exception:
            pass
        _pool = None


def get_pool() -> ConnectionPool | None:
    """Return the global connection pool, or None if not initialized."""
    return _pool


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
                -- Pull newest rows first so LIMIT doesn't clip the latest data.
                ORDER BY ts DESC
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
            else:
                # Convert back to chronological order for chart plotting.
                rows = list(reversed(rows))
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
                -- Pull newest rows first so LIMIT doesn't clip the latest data.
                ORDER BY ts DESC
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
                -- Pull newest rows first so LIMIT doesn't clip the latest data.
                ORDER BY ts DESC
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
                for point in points:
                    if not isinstance(point, dict):
                        continue
                    if point.get("kind") != "sensor_reading":
                        continue

                    # filter out non dht22 sensor readings
                    # For now, focus on DHT22 env sensor; extend as needed
                    if not (
                        point.get("sensor_type") == "DHT22"
                        or point.get("sensor_id") == "DHT22"
                    ):
                        continue
                    ts_val = point.get("timestamp")
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
                                **point,
                            },
                        )
                    )
        events.sort(key=lambda x: x[0])
        return [e[1] for e in events]
    except Exception:
        return []



def fetch_rollups_24h(conn: psycopg.Connection | None) -> list[dict[str, Any]]:
    """Rollup rows from mqtt_summary for the last 24 hours, in chronological order.

    Returns rows shaped for dashboard charting. If there are no rows in the 24h
    window, falls back to the most recent N rows so the dashboard still has data.
    """
    if not conn:
        return []

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ts, topic, report_ts, rollups
                FROM mqtt_summary
                WHERE ts >= now() - interval '24 hours'
                ORDER BY ts DESC
                LIMIT %s
                """,
                (CHART_24H_LIMIT,),
            )
            rows = cur.fetchall()

            if not rows:
                cur.execute(
                    """
                    SELECT ts, topic, report_ts, rollups
                    FROM mqtt_summary
                    ORDER BY ts DESC
                    LIMIT %s
                    """,
                    (CHART_24H_LIMIT,),
                )
                rows = cur.fetchall()

            # Convert newest-first query result into chronological order for charts
            rows = list(reversed(rows))

            out: list[dict[str, Any]] = []
            for ts, topic, report_ts, rollups in rows:
                out.append(
                    {
                        "ts": str(ts) if ts else None,
                        "topic": topic,
                        "report_ts": report_ts,
                        "rollups": rollups if isinstance(rollups, dict) else {},
                    }
                )

            return out

    except Exception:
        return []