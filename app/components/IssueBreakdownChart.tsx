"use client";
import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  Cell,
  Label,
  Tooltip,
} from "recharts";

export type IssueSlice = { issue_category: string; reports: number };

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f97316",
  "#e11d48",
  "#9333ea",
];

export default function IssueBreakdownChart({ data }: { data: IssueSlice[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sorted = [...data].sort((a, b) => b.reports - a.reports);
  const total = sorted.reduce((a, b) => a + (b.reports || 0), 0) || 1;
  const withPct = sorted.map((d) => ({ ...d, pct: (100 * d.reports) / total }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold">Issue breakdown</h2>
          <p className="text-sm text-slate-500">Share of reports by category</p>
        </div>
        <div className="text-right text-sm text-slate-600">
          Total: <span className="font-medium">{total.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ width: "100%", height: 360 }}>
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={withPct}
                dataKey="reports"
                nameKey="issue_category"
                innerRadius={80}
                outerRadius={120}
                startAngle={90}
                endAngle={-270}
                stroke="#ffffff"
                isAnimationActive
              >
                {withPct.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                <Label
                  position="center"
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox))
                      return null;
                    const { cx, cy } = viewBox as any;
                    return (
                      <g>
                        <text
                          x={cx}
                          y={cy - 6}
                          textAnchor="middle"
                          className="fill-slate-900 text-2xl font-bold"
                        >
                          {total.toLocaleString()}
                        </text>
                        <text
                          x={cx}
                          y={cy + 14}
                          textAnchor="middle"
                          className="fill-slate-500 text-xs"
                        >
                          total reports
                        </text>
                      </g>
                    );
                  }}
                />
              </Pie>
              <Tooltip
                formatter={(v: any, _n: any, p: any) => [
                  `${(v as number).toLocaleString()} (${p.payload.pct.toFixed(
                    1
                  )}%)`,
                  p.payload.issue_category,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
