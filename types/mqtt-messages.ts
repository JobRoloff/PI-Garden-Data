/**
 * TypeScript types for tables in timescaledb/init/001_create_mqtt_messages.sql
 * mqtt_summary: one row per flush (payload: ts, interval, latest, rollups, control)
 * mqtt_points: one row per flush, raw series array (payload: ts, interval, points)
 */

/** JSONB column: flexible object (latest, rollups, control) */
export type JsonObject = Record<string, unknown>;

/** JSONB column: array of points */
export type JsonArray = unknown[];

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
  points: JsonArray;
}

/** Insert payload for mqtt_summary (ts has default) */
export type MqttSummaryInsert = Omit<MqttSummaryRow, 'ts'> & { ts?: Date | string };

/** Insert payload for mqtt_points (ts has default) */
export type MqttPointsInsert = Omit<MqttPointsRow, 'ts'> & { ts?: Date | string };
