import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { LightChartPoint } from "../hooks/useGardenData";

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

function formatHourTick(t: number): string {
  const d = new Date(t);
  const hour = d.getHours();
  if (hour === 0) return "Midnight";
  if (hour === 12) return "Noon";
  if (hour > 12) return String(hour - 12);
  return String(hour);
}

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

type LightChartProps = {
  title: string;
  data: LightChartPoint[];
};

const CHANNELS: { key: keyof LightChartPoint; label: string; color: string }[] = [
  { key: "clear", label: "Clear", color: "#111827" },
  { key: "near_ir", label: "Near IR", color: "#4b5563" },
  { key: "red_680", label: "Red 680nm", color: "#ef4444" },
  { key: "orange_630", label: "Orange 630nm", color: "#f97316" },
  { key: "yellow_590", label: "Yellow 590nm", color: "#facc15" },
  { key: "green_555", label: "Green 555nm", color: "#22c55e" },
  { key: "cyan_515", label: "Cyan 515nm", color: "#06b6d4" },
  { key: "blue_480", label: "Blue 480nm", color: "#3b82f6" },
  { key: "indigo_445", label: "Indigo 445nm", color: "#6366f1" },
  { key: "violet_451", label: "Violet 451nm", color: "#a855f7" },
];

export function LightChart({ title, data }: LightChartProps) {
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
            No light spectrum data for the recent window
          </div>
        )}
        {hasData && (
          <ResponsiveContainer width="100%" height={300}>
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
                domain={["dataMin - 50", "dataMax + 50"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
                labelFormatter={(time: number) =>
                  typeof time === "number"
                    ? new Date(time).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : String(time)
                }
              />
              <Legend />
              {CHANNELS.map(({ key, label, color }) => (
                <Line
                  key={key as string}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

