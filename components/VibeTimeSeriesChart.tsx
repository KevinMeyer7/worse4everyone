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

const COLORS = {
  worse: "#ef4444", // rose-500
  better: "#22c55e", // emerald-500
  net: "#64748b", // slate-500
  index: "#0ea5e9", // sky-500
  grid: "rgba(148,163,184,.25)", // slate-400 @ 25%
};

const labelForKey: Record<string, string> = {
  worse_w: "Worse (weighted)",
  better_w: "Better (weighted)",
  net_w: "Net (w−b)",
  index_100: "Index",
};

export default function VibeTimeseriesChart({ data }: { data: Point[] }) {
  const [mode, setMode] = useState<Mode>("index");
  const rows = useMemo(() => data ?? [], [data]);
  const hasIndex = rows.some((r) => typeof r.index_100 === "number");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/70">
          {mode === "counts"
            ? "Daily weighted points: red = worse, green = better, gray = net (w−b)."
            : "0–100 worseness index (50 ≈ baseline; above is worse, below is better)."}
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
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis
                domain={[0, 100]}
                tickCount={6}
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
              <ReferenceLine
                y={50}
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v, _n, payload: any) => {
                  const key = payload?.dataKey as string;
                  return [
                    Number(v as number).toFixed(0),
                    labelForKey[key] ?? "Index",
                  ];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="index_100"
                name="Index"
                stroke={COLORS.index}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive
              />
            </LineChart>
          ) : (
            <LineChart data={rows}>
              <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis
                label={{
                  value: "Weighted report points / day",
                  angle: -90,
                  position: "insideLeft",
                  style: {
                    fill: "var(--foreground)",
                    opacity: 0.65,
                    fontSize: 12,
                  },
                }}
              />
              <ReferenceLine
                y={0}
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v, _n, payload: any) => {
                  const key = payload?.dataKey as string;
                  return [
                    Number(v as number).toFixed(1),
                    labelForKey[key] ?? key,
                  ];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="worse_w"
                name={labelForKey.worse_w}
                stroke={COLORS.worse}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="better_w"
                name={labelForKey.better_w}
                stroke={COLORS.better}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive
              />
              <Line
                type="monotone"
                dataKey="net_w"
                name={labelForKey.net_w}
                stroke={COLORS.net}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls
                isAnimationActive
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
