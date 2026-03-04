-- Drop old single-table schema if you're starting fresh:
-- DROP TABLE IF EXISTS mqtt_messages;

-- Summary messages (main topic): one row per flush
-- Payload shape: ts, interval, latest, rollups, control
CREATE TABLE IF NOT EXISTS mqtt_summary (
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  topic TEXT NOT NULL,
  report_ts DOUBLE PRECISION NOT NULL,
  interval_first_ts DOUBLE PRECISION,
  interval_last_ts DOUBLE PRECISION,
  sample_count INTEGER,
  dt_sec DOUBLE PRECISION,
  latest JSONB NOT NULL DEFAULT '{}',
  rollups JSONB NOT NULL DEFAULT '{}',
  control JSONB NOT NULL DEFAULT '{}'
);

-- Points messages (points topic): one row per flush, raw series array.
-- Payload shape (outer envelope): ts|timestamp, interval, points
-- Each element in points is a discriminated union:
--   - Sensor reading:
--       { "timestamp": <float>, "kind": "sensor_reading", "sensor_id": "...", "sensor_type": "...",
--         "series": { <measurement_name>: <number>, ... },
--         "actuators": { <actuator_id>: <bool|number>, ... } }
--   - Actuator event:
--       { "timestamp": <float>, "kind": "actuator_event", "actuator_id": "...",
--         "value": <bool|number>, "reason": "...", "requested_duration_s": <float|null> }
CREATE TABLE IF NOT EXISTS mqtt_points (
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  topic TEXT NOT NULL,
  report_ts DOUBLE PRECISION NOT NULL,
  interval_first_ts DOUBLE PRECISION,
  interval_last_ts DOUBLE PRECISION,
  sample_count INTEGER,
  dt_sec DOUBLE PRECISION,
  points JSONB NOT NULL DEFAULT '[]'
);

CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT create_hypertable('mqtt_summary', 'ts', if_not_exists => TRUE);
SELECT create_hypertable('mqtt_points', 'ts', if_not_exists => TRUE);
