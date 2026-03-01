#!/usr/bin/env python3
"""
Publish one message to the project's MQTT broker.

Run from any device on the same LAN (e.g. a Pi or third machine). Use the
broker's LAN IP (e.g. 192.168.1.66), not "localhost" or "mosquitto".

Requirements: pip install paho-mqtt

Usage:
  python mqtt_publish.py
  MQTT_BROKER_HOST=192.168.1.66 python mqtt_publish.py
  python mqtt_publish.py --topic "pi-peripherals" --message '{"from":"using pi-peripherals"}'
"""
import argparse
import os
import time
import json

try:
    import paho.mqtt.client as mqtt
except ImportError:
    raise SystemExit("Install paho-mqtt: pip install paho-mqtt")

DEFAULT_HOST = os.environ.get("MQTT_BROKER_HOST", "192.168.1.66")
DEFAULT_PORT = int(os.environ.get("MQTT_BROKER_PORT", "1883"))
DEFAULT_TOPIC = "pi-peripherals"


def main():
    parser = argparse.ArgumentParser(description="Publish one MQTT message to the broker")
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Broker host (default: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Broker port")
    parser.add_argument("--topic", default=DEFAULT_TOPIC, help="Topic to publish to")
    parser.add_argument("--message", "-m", default='{"from":"using pi-peripherals"}', help="Payload string")
    parser.add_argument("--qos", type=int, default=0, choices=(0, 1, 2), help="QoS")
    args = parser.parse_args()

    client = mqtt.Client(client_id="python-publisher")
    # Optional: uncomment if your broker uses auth (this project uses allow_anonymous true)
    # client.username_pw_set("user", "pass")

    def on_connect(c, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            print(f"[mqtt] connected to {args.host}:{args.port}")
        else:
            print(f"[mqtt] connect failed reason_code={reason_code}")

    def on_publish(c, userdata, mid):
        print(f"[mqtt] published mid={mid}")

    client.on_connect = on_connect
    client.on_publish = on_publish

    print(f"[mqtt] connecting to {args.host}:{args.port} ...")
    client.connect(args.host, args.port, keepalive=60)

    # Critical: start the network loop so connect and publish actually run
    client.loop_start()
    time.sleep(0.5)  # allow connect to complete

    msg_info = client.publish(args.topic, args.message, qos=args.qos)
    msg_info.wait_for_publish()  # block until publish is sent (or timeout)
    time.sleep(0.2)

    client.loop_stop()
    client.disconnect()
    print(f"[mqtt] done. topic={args.topic!r}")


if __name__ == "__main__":
    main()
