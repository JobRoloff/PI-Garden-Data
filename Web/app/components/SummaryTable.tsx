"use client";

import { useEffect, useState } from "react";

type SummaryRow = {
  ts: string;
  topic: string;
  report_ts: number;
  interval_first_ts: number | null;
  interval_last_ts: number | null;
  sample_count: number | null;
  dt_sec: number | null;
  latest: Record<string, unknown>;
  rollups: Record<string, unknown>;
  control: Record<string, unknown>;
};

export function SummaryTable() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/summary?limit=50")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="table-loading">Loading summary…</div>;
  if (error) return <div className="table-error">Error: {error}</div>;
  if (rows.length === 0) return <div className="table-empty">No summary rows yet.</div>;

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
            <th>latest</th>
            <th>rollups</th>
            <th>control</th>
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
              <td className="json-cell">{JSON.stringify(row.latest)}</td>
              <td className="json-cell">{JSON.stringify(row.rollups)}</td>
              <td className="json-cell">{JSON.stringify(row.control)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
