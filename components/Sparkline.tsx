"use client";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export type Point = { day: string; reports: number };

export default function Sparkline({ data }: { data: Point[] }) {
  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
        >
          <Area
            type="monotone"
            dataKey="reports"
            fill="#dbeafe"
            stroke="#2563eb"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
