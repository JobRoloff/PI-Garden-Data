import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import React from "react";

interface DataPoint {
  timestamp: string;
  time: number;
  value: number;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

/** Format tick as 12-hour (1–12), with "Midnight" for 0 and "Noon" for 12. Hours 13–23 show as 1–11. */
function formatHourTick(t: number): string {
  const d = new Date(t);
  const hour = d.getHours();
  if (hour === 0) return "Midnight";
  if (hour === 12) return "Noon";
  if (hour > 12) return String(hour - 12);
  return String(hour);
}

/** Domain and 24 hourly ticks for "past 24 hours" from now. */
function getChart24hDomainAndTicks(): { domain: [number, number]; ticks: number[] } {
  const endMs = Date.now();
  const startMs = endMs - TWENTY_FOUR_HOURS_MS;
  const startHourMs = Math.floor(startMs / ONE_HOUR_MS) * ONE_HOUR_MS;
  const ticks: number[] = [];
  for (let i = 0; i < 24; i++) {
    ticks.push(startHourMs + i * ONE_HOUR_MS);
  }
  return { domain: [startMs, endMs], ticks };
}

interface SensorChartProps {
  title: string;
  data: DataPoint[];
  color?: string;
  unit?: string;
}

export function SensorChart({
  title,
  data,
  color = "var(--md-sys-color-primary)",
  unit,
}: SensorChartProps) {
  const hasData = data.length > 0;
  const { domain, ticks } = getChart24hDomainAndTicks();
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData && (
          <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
            No data for the past 24 hours
          </div>
        )}
        {hasData && (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="time"
              type="number"
              angle={-45}
              tick={{ fontSize: 12, textAnchor: "end" }}
              stroke="#9ca3af"
              domain={domain}
              tickFormatter={formatHourTick}
              ticks={ticks}
              interval={0}
            />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 12 }}
              domain={["dataMin - 5", "dataMax + 5"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
              formatter={(value: number) => [`${value}${unit || ""}`, "Value"]}
              labelFormatter={(time: number) =>
                typeof time === "number" ? new Date(time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : String(time)
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
