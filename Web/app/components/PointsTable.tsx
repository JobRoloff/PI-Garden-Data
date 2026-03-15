"use client";

import { useEffect, useState } from "react";

type PointsRow = {
  ts: string;
  topic: string;
  report_ts: number;
  interval_first_ts: number | null;
  interval_last_ts: number | null;
  sample_count: number | null;
  dt_sec: number | null;
  points: unknown[];
};

export function PointsTable() {
  const [rows, setRows] = useState<PointsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/points?limit=50")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="table-loading">Loading points…</div>;
  if (error) return <div className="table-error">Error: {error}</div>;
  if (rows.length === 0) return <div className="table-empty">No points rows yet.</div>;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>ts</th>
            <th>topic</th>
            <th>report_ts</th>
            <th>interval_first_ts</th>
            <th>interval_last_ts</th>
            <th>sample_count</th>
            <th>dt_sec</th>
            <th>points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.ts}-${i}`}>
              <td>{new Date(row.ts).toISOString()}</td>
              <td>{row.topic}</td>
              <td>{row.report_ts}</td>
              <td>{row.interval_first_ts ?? "—"}</td>
              <td>{row.interval_last_ts ?? "—"}</td>
              <td>{row.sample_count ?? "—"}</td>
              <td>{row.dt_sec ?? "—"}</td>
              <td className="json-cell">{JSON.stringify(row.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
