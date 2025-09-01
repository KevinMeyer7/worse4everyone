"use client";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  ReferenceLine,
  YAxis,
} from "recharts";

// Keep the same shape you already use – we'll map index -> reports in the card.
export type Point = { day: string; reports: number };

export default function Sparkline({
  data,
  baseline = 50,
}: {
  data: Point[];
  baseline?: number;
}) {
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
        >
          {/* Clamp to 0..100 because this is the normalized index */}
          <YAxis hide domain={[0, 100]} />
          {/* Neutral baseline */}
          <ReferenceLine
            y={baseline}
            stroke="var(--border)"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
          />
          <Area
            type="monotone"
            dataKey="reports"
            fill="#dbeafe"
            stroke="#2563eb"
            strokeWidth={2}
            isAnimationActive
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
