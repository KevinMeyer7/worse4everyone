"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import type { TooltipProps } from "recharts";
import type {
  ValueType,
  NameType,
  Payload as TooltipPayload,
} from "recharts/types/component/DefaultTooltipContent";

type Row = {
  pct_w?: number;
  environment?: string;
};

type V = number;
type N = string;

const tooltipFormatter: TooltipProps<V, N>["formatter"] = (
  value: V | ValueType,
  _name: N | NameType,
  item: TooltipPayload<V, N>
) => {
  const payload = (item?.payload ?? {}) as Row;
  const pct = payload.pct_w ?? 0;
  const env = payload.environment ?? "";

  return [`${Number(value).toFixed(1)} (${pct.toFixed(1)}%)`, env];
};

export type EnvRow = { environment: string; reports_w: number; pct_w: number };

const BAR_COLORS = [
  "#22C55E",
  "#10B981",
  "#0EA5E9",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#84CC16",
  "#06B6D4",
  "#F97316",
  "#E11D48",
];

export default function EnvBreakdownBar({ data }: { data: EnvRow[] }) {
  // ⚠️ functionality unchanged
  const rows = [...data].sort((a, b) => b.reports_w - a.reports_w);
  const total = rows.reduce((a, b) => a + (b.reports_w || 0), 0) || 1;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-foreground/70">
        <span>Weighted worse reports by environment</span>
        <span>
          Total: <span className="font-medium">{total.toFixed(1)}</span>
        </span>
      </div>

      <div className="h-[320px] w-full rounded-2xl border border-border bg-background p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="2 4"
              opacity={0.35}
              horizontal
              vertical={false}
            />
            <XAxis
              type="number"
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              type="category"
              dataKey="environment"
              width={140}
              tick={{ fill: "var(--foreground)", fontSize: 12 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={{ stroke: "var(--border)" }}
            />
            <Tooltip
              formatter={tooltipFormatter}
              contentStyle={{
                background: "color-mix(in srgb, var(--background) 85%, black)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                borderRadius: "0.75rem",
                boxShadow: "0 6px 18px rgba(0,0,0,.35)",
              }}
              labelStyle={{ color: "var(--foreground)", opacity: 0.85 }}
              itemStyle={{ color: "var(--foreground)" }}
              cursor={{ fill: "transparent" }}
            />
            <Bar
              dataKey="reports_w"
              name="Weighted worse"
              radius={[6, 6, 6, 6]}
              barSize={18}
              stroke="var(--background)"
              strokeWidth={0}
            >
              {rows.map((_, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={BAR_COLORS[i % BAR_COLORS.length]}
                  stroke="var(--border)"
                  strokeWidth={1.1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
