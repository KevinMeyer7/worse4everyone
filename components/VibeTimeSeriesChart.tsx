"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

type Point = {
  day: string;
  worse_w: number;
  better_w: number;
  net_w: number;
  index_100?: number;
};

type Mode = "index" | "counts";

export default function VibeTimeseriesChart({ data }: { data: Point[] }) {
  const [mode, setMode] = useState<Mode>("index");
  const rows = useMemo(() => data ?? [], [data]);
  const hasIndex = rows.some((r) => typeof r.index_100 === "number");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/70">
          {mode === "counts"
            ? "Daily weighted points (worse, better, and net)."
            : "0–100 worseness index (50≈baseline; >50 worse than usual)."}
        </p>
        <div className="rounded-lg border border-border text-xs">
          <button
            className={`px-2 py-1 ${mode === "index" ? "bg-muted/60" : ""}`}
            onClick={() => setMode("index")}
            disabled={!hasIndex}
            title={hasIndex ? "" : "Index not available"}
          >
            Index
          </button>
          <button
            className={`border-l border-border px-2 py-1 ${
              mode === "counts" ? "bg-muted/60" : ""
            }`}
            onClick={() => setMode("counts")}
          >
            Counts
          </button>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "index" ? (
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis
                domain={[0, 100]}
                label={{
                  value: "Worseness index (0–100)",
                  angle: -90,
                  position: "insideLeft",
                  style: {
                    fill: "var(--foreground)",
                    opacity: 0.65,
                    fontSize: 12,
                  },
                }}
              />
              <ReferenceLine y={50} strokeDasharray="4 4" />
              <Tooltip
                formatter={(v: number | string) => [
                  Number(v).toFixed(0),
                  "Index",
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="index_100"
                name="Index"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          ) : (
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis
                label={{
                  value: "Weighted report points/day",
                  angle: -90,
                  position: "insideLeft",
                  style: {
                    fill: "var(--foreground)",
                    opacity: 0.65,
                    fontSize: 12,
                  },
                }}
              />
              <Tooltip
                formatter={(v: number | string, n: string) => [
                  Number(v).toFixed(1),
                  n === "net_w"
                    ? "Net (worse−better)"
                    : n === "worse_w"
                    ? "Worse (weighted)"
                    : "Better (weighted)",
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="worse_w"
                name="Worse (weighted)"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="better_w"
                name="Better (weighted)"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="net_w"
                name="Net (w−b)"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
