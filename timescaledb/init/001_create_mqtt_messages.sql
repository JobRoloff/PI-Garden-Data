CREATE TABLE IF NOT EXISTS mqtt_messages (
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  topic TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT create_hypertable('mqtt_messages', 'ts', if_not_exists => TRUE);