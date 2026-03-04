/**
 * TypeScript types for tables in timescaledb/init/001_create_mqtt_messages.sql
 * mqtt_summary: one row per flush (payload: ts, interval, latest, rollups, control)
 * mqtt_points: one row per flush, raw series array (payload: ts, interval, points)
 *
 * The mqtt_points.points JSONB column contains an array of domain points with an explicit
 * event discriminator and normalized sensor / actuator structure:
 *
 * - Sensor reading:
 *   {
 *     "timestamp": 1772555726.4194,
 *     "kind": "sensor_reading",
 *     "sensor_id": "climate_1",
 *     "sensor_type": "climate",
 *     "series": { "temp": 21.4, "humidity": 50.6 },
 *     "actuators": { "humidifier": true }
 *   }
 *
 * - Actuator event:
 *   {
 *     "timestamp": 1772555726.4197,
 *     "kind": "actuator_event",
 *     "actuator_id": "humidifier",
 *     "value": true,
 *     "reason": "humidity 50.6% below target (run 5s)",
 *     "requested_duration_s": 5.0
 *   }
 *
 */

/** JSONB column: flexible object (latest, rollups, control) */
export type JsonObject = Record<string, unknown>;

/** JSONB column: array of points (see MqttPoint union below) */
export type JsonArray = unknown[];

/**
 * Base shape for a point stored in mqtt_points.points.
 * All points MUST have a timestamp and an explicit kind.
 *
 * Notes:
 * - "timestamp" is preferred; legacy payloads may still use "ts".
 */
export interface BaseMqttPoint {
  /** Seconds since epoch (floating) */
  timestamp: number;
  /** Discriminator for the concrete point type */
  kind: 'sensor_reading' | 'actuator_event';
}

/** Snapshot of sensor measurements at a given time. */
export interface SensorReadingPoint extends BaseMqttPoint {
  kind: 'sensor_reading';
  sensor_id: string;
  sensor_type: string;
  /**
   * Wide map of measurement name to value.
   *
   * Examples:
   * - dht22:  { temp: 21.4, humidity: 50.6 }
   * - as7341: { clear: 13724, near_ir: 2570, red_680: 10295, ... }
   */
  series: Record<string, number>;
  /**
   * Optional snapshot of actuator states at this timestamp, keyed by actuator_id.
   * Values are typically booleans (on/off) or small numeric settings (e.g., %).
   */
  actuators?: Record<string, boolean | number>;
}

/**
 * Actuator event representing a command or change in actuator state.
 *
 * This is separate from the per-reading "actuators" snapshot so that you can
 * see both the live state at sampling times and the discrete events that led
 * to those states.
 */
export interface ActuatorEventPoint extends BaseMqttPoint {
  kind: 'actuator_event';
  actuator_id: string;
  /**
   * Target value for the actuator.
   * For simple on/off actuators this is a boolean; for others it may be a
   * numeric level or percentage.
   */
  value: boolean | number;
  /** Optional human-readable explanation for the change */
  reason?: string;
  /**
   * Requested duration for the actuator to remain in this state, if applicable.
   * May be null or omitted when the change is open-ended (e.g., "until further notice").
   */
  requested_duration_s?: number | null;
}

/** Discriminated union of all point types stored in mqtt_points.points. */
export type MqttPoint = SensorReadingPoint | ActuatorEventPoint;

/**
 * mqtt_summary table
 * Summary messages (main topic): one row per flush
 */
export interface MqttSummaryRow {
  ts: Date | string;
  topic: string;
  report_ts: number;
  interval_first_ts: number | null;
  interval_last_ts: number | null;
  sample_count: number | null;
  dt_sec: number | null;
  latest: JsonObject;
  rollups: JsonObject;
  control: JsonObject;
}

/**
 * mqtt_points table
 * Points messages (points topic): one row per flush, raw series array
 */
export interface MqttPointsRow {
  ts: Date | string;
  topic: string;
  report_ts: number;
  interval_first_ts: number | null;
  interval_last_ts: number | null;
  sample_count: number | null;
  dt_sec: number | null;
  /** Raw JSONB array; see MqttPoint for the recommended element shape. */
  points: JsonArray | MqttPoint[];
}

/** Insert payload for mqtt_summary (ts has default) */
export type MqttSummaryInsert = Omit<MqttSummaryRow, 'ts'> & { ts?: Date | string };

/** Insert payload for mqtt_points (ts has default) */
export type MqttPointsInsert = Omit<MqttPointsRow, 'ts'> & { ts?: Date | string };
