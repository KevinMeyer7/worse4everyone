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
  day: string; // "YYYY-MM-DD"
  worse_w: number;
  better_w: number;
  net_w: number;
  index_100?: number;
};

type Mode = "index" | "counts";

function parseDayToUTC(d: string): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, day || 1);
}

export default function VibeTimeseriesChart({
  data,
  focusFromISO,
  focusToISO,
}: {
  data: Point[];
  focusFromISO?: string;
  focusToISO?: string;
}) {
  const [mode, setMode] = useState<Mode>("index");
  const hasIndex = data?.some((r) => typeof r.index_100 === "number");

  const rows = useMemo(() => {
    if (!data) return [];
    if (!focusFromISO || !focusToISO) return data;
    const from = Date.parse(focusFromISO);
    const to = Date.parse(focusToISO);
    return data.filter((r) => {
      const t = parseDayToUTC(r.day);
      return t >= from && t < to;
    });
  }, [data, focusFromISO, focusToISO]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/70">
          {mode === "counts"
            ? "Daily weighted points: worse, better, and net (worse − better)."
            : "0–100 worseness index (50 ≈ baseline; higher is worse than usual)."}
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
                stroke="#2563eb"
                isAnimationActive={false}
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
                formatter={(
                  value: number | string,
                  _name: string,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  item: any
                ) => {
                  const dk: string = item && item.dataKey;
                  const label =
                    dk === "net_w"
                      ? "Net (worse − better)"
                      : dk === "worse_w"
                      ? "Worse (weighted)"
                      : dk === "better_w"
                      ? "Better (weighted)"
                      : dk || "value";
                  return [Number(value).toFixed(1), label];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="worse_w"
                name="Worse (weighted)"
                dot={false}
                strokeWidth={2}
                stroke="#ef4444" // red
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="better_w"
                name="Better (weighted)"
                dot={false}
                strokeWidth={2}
                stroke="#22c55e" // green
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="net_w"
                name="Net (w − b)"
                dot={false}
                strokeWidth={2}
                stroke="#a855f7" // purple
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
