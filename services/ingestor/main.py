"""
Subscribes to a MQTT topic specified in root lvl .env file.
(Next step: write to DB on each message.)
"""
import os
import time
from pathlib import Path
from dotenv import load_dotenv
import paho.mqtt.client as mqtt

import psycopg

# Load .env from project root first, then service dir (so DATABASE_URL works when run from any cwd)
_root = Path(__file__).resolve().parent.parent.parent
for _d in (_root, Path(__file__).resolve().parent):
    _env = _d / ".env"
    if _env.is_file():
        load_dotenv(_env)
load_dotenv()  # fallback: cwd .env

INSERT_SQL = "INSERT INTO mqtt_messages (topic, payload) VALUES (%s, %s);"


def getenv_int(key: str, default: int) -> int:
    val = os.getenv(key)
    return int(val) if val and val.strip() else default

def on_connect(client: mqtt.Client, userdata, flags, reason_code, properties=None):
    topic = userdata["topic"]
    qos = userdata["qos"]
    # Note: "pi-peripherals" matches only that exact topic; use "pi-peripherals/#" to match subtopics
    print(f"[mqtt] connected (reason_code={reason_code}); subscribing to '{topic}' qos={qos}")
    client.subscribe(topic, qos=qos)

def on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage):
    topic = msg.topic
    payload = msg.payload.decode("utf-8", errors="replace")
    print(f"[mqtt] {topic} qos={msg.qos} retain={msg.retain} payload={payload}")
    conn: psycopg.Connection = userdata["db_conn"]
    try:
        with conn.cursor() as curr:
            curr.execute(INSERT_SQL, (topic, payload))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"[db] insert failed: {e!r}")

def on_disconnect(client: mqtt.Client, userdata, reason_code, properties=None):
    print(f"[mqtt] disconnected (reason_code={reason_code})")

def main():
    topic = os.getenv("MQTT_TOPIC")
    if not topic:
        raise SystemExit("Missing MQTT_TOPIC in .env")


    mqtt_host = os.getenv("MQTT_HOST", "localhost")
    mqtt_port = getenv_int("MQTT_PORT", 1883)
    client_id = os.getenv("MQTT_CLIENT_ID", "ingestor")
    qos = getenv_int("MQTT_QOS", 0)

    username = os.getenv("MQTT_USERNAME") or None
    password = os.getenv("MQTT_PASSWORD") or None
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise SystemExit(
            "Missing DATABASE_URL (or DB_URL) in env (e.g., postgres://postgres:postgres@timescaledb:5432/app)"
        )

    # Connect to DB and ensure init script has created the table (handles post down -v startup)
    for attempt in range(1, 31):
        try:
            db_conn = psycopg.connect(db_url)
            with db_conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mqtt_messages'"
                )
                if cur.fetchone() is None:
                    db_conn.close()
                    raise RuntimeError("table mqtt_messages not found")
            print("[db] connected and table mqtt_messages ready")
            break
        except Exception as e:
            if attempt == 30:
                raise SystemExit(f"[db] failed after 30 attempts: {e}")
            print(f"[db] attempt {attempt}/30: {e}, retrying in 2s ...")
            time.sleep(2)
    userdata = {"topic": topic, "qos": qos, "db_conn": db_conn}
    
    client = mqtt.Client(client_id=client_id, userdata=userdata)
    if username is not None:
        client.username_pw_set(username, password)

    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    print(f"[mqtt] connecting to {mqtt_host}:{mqtt_port} as '{client_id}' (topic={topic!r}) ...")
    client.connect(mqtt_host, mqtt_port, keepalive=60)

    # background network loop (reconnects if you call client.reconnect_delay_set)
    client.reconnect_delay_set(min_delay=1, max_delay=30)
    client.loop_start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[mqtt] stopping...")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()