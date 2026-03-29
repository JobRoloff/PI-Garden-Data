import asyncio
import json
import os

from contextlib import asynccontextmanager
from typing import Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from db_service import ( get_pool, init_pool, close_pool, fetch_latest_sensor_readings, fetch_scalar_points_24h, fetch_light_points_24h, fetch_chart_data_24h, fetch_recent_event_feed, fetch_recent_actuator_events, )
POLL_INTERVAL_SEC = float(os.getenv("WS_POLL_INTERVAL_SEC", "30"))

# All connected WebSocket clients
connections: set[WebSocket] = set()

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
        pool = get_pool()
        status: dict[str, Any] = {
            "connected": pool is not None,
            "database_ok": pool is not None,
        }
        if pool:
            try:
                with pool.connection() as conn:
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
        else:
            await broadcast({"type": "connection_status", "payload": status})
        await asyncio.sleep(POLL_INTERVAL_SEC)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_pool()
    task = asyncio.create_task(poll_and_broadcast())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    close_pool()


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
    pool = get_pool()
    if not pool:
        return []
    with pool.connection() as conn:
        return fetch_chart_data_24h(conn)


@app.get("/light-points-24h")
def light_points_24h():
    """Return light spectrum sensor_reading events for last 24 hours (AS7341Module/light)."""
    pool = get_pool()
    if not pool:
        return []
    with pool.connection() as conn:
        return fetch_light_points_24h(conn)


@app.get("/scalar-points-24h")
def scalar_points_24h():
    """Return scalar sensor_reading events (e.g. DHT22 temp/humidity) for last 24 hours."""
    pool = get_pool()
    if not pool:
        return []
    with pool.connection() as conn:
        return fetch_scalar_points_24h(conn)


@app.websocket("/ws")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    connections.add(websocket)
    try:
        await websocket.send_text(
            json.dumps({"type": "connection_status", "payload": {"connected": True, "stream": "ready"}})
        )
        # Keep the connection open; broadcasts happen from the poll task.
        # We only read incoming messages to detect disconnects and optionally reply to "ping".
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong", "payload": {}}))
            except json.JSONDecodeError:
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
