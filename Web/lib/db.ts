import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

function getPool(): Pool {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({ connectionString });
}

export async function querySummary(limit: number = 50) {
  const pool = getPool();
  const res = await pool.query(
    `SELECT ts, topic, report_ts, interval_first_ts, interval_last_ts, sample_count, dt_sec, latest, rollups, control
     FROM mqtt_summary
     ORDER BY ts DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function queryPoints(limit: number = 50) {
  const pool = getPool();
  const res = await pool.query(
    `SELECT ts, topic, report_ts, interval_first_ts, interval_last_ts, sample_count, dt_sec, points
     FROM mqtt_points
     ORDER BY ts DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}
