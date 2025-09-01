"use client";
import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  Cell,
  Label,
  Tooltip,
} from "recharts";
import type { PieLabelRenderProps, TooltipProps } from "recharts";
import type {
  ValueType,
  NameType,
  Payload as TooltipPayload,
} from "recharts/types/component/DefaultTooltipContent";

/** Accept both old & new pipe shapes */
export type IssueSlice = {
  issue_category?: string; // old
  reports?: number; // old
  issue_tag?: string; // new
  reports_w?: number; // new (weighted)
  reports_n?: number; // new (raw)
};

type Mode = "weighted" | "raw";

/** terminal-friendly palette with strong contrast */
const COLORS = [
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

const RADIAN = Math.PI / 180;

/** The normalized datum used by the chart */
type Row = {
  name: string;
  value: number;
  pct: number;
  // keep these optional so label code can use them if present
  issue_tag?: string;
  issue_category?: string;
};

/** Custom label with leader line (what Recharts passes to label renderer) */
interface SliceLabelProps extends PieLabelRenderProps {
  payload: Row;
  value: number;
  index: number;
  outerRadius: number;
}

function renderSliceLabel(props: SliceLabelProps) {
  const { cx, cy, midAngle, outerRadius, percent, index, payload, value } =
    props;

  // Hide very small slices to reduce clutter
  if (percent === undefined || percent < 0.05) return null;

  // Ensure cx, cy, and outerRadius are numbers
  const cxNum = typeof cx === "number" ? cx : Number(cx);
  const cyNum = typeof cy === "number" ? cy : Number(cy);
  const outerRadiusNum =
    typeof outerRadius === "number" ? outerRadius : Number(outerRadius);

  const angle = -midAngle * RADIAN;
  const sx = cxNum + Math.cos(angle) * (outerRadiusNum + 6);
  const sy = cyNum + Math.sin(angle) * (outerRadiusNum + 6);
  const ex = cxNum + Math.cos(angle) * (outerRadiusNum + 20);
  const ey = cyNum + Math.sin(angle) * (outerRadiusNum + 20);
  const isRight = Math.cos(angle) >= 0;
  const tx = ex + (isRight ? 10 : -10);
  const ty = ey;

  const color = COLORS[index % COLORS.length];
  const name: string =
    payload.issue_tag ??
    payload.issue_category ??
    payload.name ??
    `Slice ${index + 1}`;
  const pctText = `${(percent * 100).toFixed(1)}%`;

  return (
    <g>
      {/* leader line */}
      <path
        d={`M${sx},${sy} L${ex},${ey} L${tx - (isRight ? 6 : -6)},${ty}`}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      {/* endpoint dot */}
      <circle cx={ex} cy={ey} r={2.5} fill={color} />
      {/* label text */}
      <text
        x={tx}
        y={ty}
        textAnchor={isRight ? "start" : "end"}
        dominantBaseline="middle"
        style={{
          fill: "var(--foreground)",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        {name}
      </text>
      <text
        x={tx}
        y={ty + 14}
        textAnchor={isRight ? "start" : "end"}
        dominantBaseline="middle"
        style={{
          fill: "color-mix(in srgb, var(--foreground) 70%, transparent)",
          fontSize: "11px",
        }}
      >
        {value.toLocaleString()} • {pctText}
      </text>
    </g>
  );
}

/** Strongly typed tooltip formatter */
const tooltipFormatter: TooltipProps<number, string>["formatter"] = (
  v: ValueType,
  _n: NameType,
  p: TooltipPayload<number, string>
) => {
  const payload = p?.payload as Row | undefined;
  const valueNumber =
    typeof v === "number" ? v : Number.isFinite(Number(v)) ? Number(v) : 0;
  const pctText =
    typeof payload?.pct === "number" ? payload.pct.toFixed(1) : "0.0";
  return [`${valueNumber.toLocaleString()} (${pctText}%)`, payload?.name ?? ""];
};

export default function IssueBreakdownChart({
  data,
  defaultMode = "weighted",
  showModeToggle = true,
}: {
  data: IssueSlice[];
  /** start in 'weighted' (reports_w) or 'raw' (reports_n / reports) */
  defaultMode?: Mode;
  /** show a tiny toggle UI (weighted/raw) */
  showModeToggle?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>(defaultMode);
  useEffect(() => setMounted(true), []);

  // Normalize rows to { name, value, pct }
  const rows = useMemo<Row[]>(() => {
    return (data ?? []).map((d) => {
      const name = d.issue_tag ?? d.issue_category ?? "Other";
      const value =
        mode === "weighted"
          ? // prefer weighted -> fallback to old single 'reports'
            typeof d.reports_w === "number"
            ? d.reports_w
            : d.reports ?? 0
          : // raw -> prefer reports_n -> fallback to old 'reports'
          typeof d.reports_n === "number"
          ? d.reports_n
          : d.reports ?? 0;
      return { name, value: Math.max(0, Number(value || 0)), pct: 0 };
    });
  }, [data, mode]);

  const sorted: Row[] = [...rows].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((a, b) => a + (b.value || 0), 0) || 0;
  const withPct: Row[] = sorted.map((d) => ({
    ...d,
    pct: total ? (100 * d.value) / total : 0,
  }));

  return (
    <div className="rounded-2xl border border-border bg-background p-6 text-foreground shadow-sm">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Issue breakdown</h2>
          <p className="text-sm text-foreground/70">
            Share of reports by category
            {mode === "weighted" ? " (weighted)" : " (raw)"}
          </p>
        </div>
        <div className="flex items-center gap-3 text-right text-sm text-foreground/80">
          <div>
            Total: <span className="font-medium">{total.toLocaleString()}</span>
          </div>
          {showModeToggle && (
            <div className="rounded-lg border border-border">
              <button
                className={`px-2 py-1 text-xs ${
                  mode === "raw" ? "bg-muted/60" : ""
                }`}
                onClick={() => setMode("raw")}
              >
                Raw
              </button>
              <button
                className={`px-2 py-1 text-xs border-l border-border ${
                  mode === "weighted" ? "bg-muted/60" : ""
                }`}
                onClick={() => setMode("weighted")}
              >
                Weighted
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ width: "100%", height: 360 }}>
        {mounted && total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 24, right: 48, bottom: 24, left: 48 }}>
              <Pie
                data={withPct}
                dataKey="value"
                nameKey="name"
                innerRadius={80}
                outerRadius={120}
                startAngle={90}
                endAngle={-270}
                stroke="var(--border)"
                strokeWidth={2}
                paddingAngle={1}
                cornerRadius={2}
                isAnimationActive={true}
                labelLine={false}
                label={(props: PieLabelRenderProps) =>
                  typeof props.midAngle === "number"
                    ? renderSliceLabel(props as SliceLabelProps)
                    : null
                }
              >
                {withPct.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                <Label
                  position="center"
                  content={({ viewBox }) => {
                    if (
                      !viewBox ||
                      typeof viewBox !== "object" ||
                      viewBox === null ||
                      typeof (viewBox as { cx?: unknown }).cx !== "number" ||
                      typeof (viewBox as { cy?: unknown }).cy !== "number"
                    ) {
                      return null;
                    }
                    const { cx, cy } = viewBox as { cx: number; cy: number };
                    return (
                      <g>
                        <text
                          x={cx}
                          y={cy - 6}
                          textAnchor="middle"
                          className="fill-current text-foreground text-2xl font-bold"
                        >
                          {total.toLocaleString()}
                        </text>
                        <text
                          x={cx}
                          y={cy + 14}
                          textAnchor="middle"
                          className="fill-current text-foreground/60 text-xs"
                        >
                          {mode === "weighted" ? "weighted" : "raw"} total
                        </text>
                      </g>
                    );
                  }}
                />
              </Pie>
              <Tooltip<number, string>
                formatter={tooltipFormatter}
                contentStyle={{
                  background:
                    "color-mix(in srgb, var(--background) 85%, black)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  borderRadius: "0.75rem",
                  boxShadow: "0 6px 18px rgba(0,0,0,.35)",
                }}
                labelStyle={{ color: "var(--foreground)", opacity: 0.85 }}
                itemStyle={{ color: "var(--foreground)" }}
                cursor={{ fill: "transparent" }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="rounded-xl border border-border bg-background p-12 text-center text-foreground/70">
            No data.
          </div>
        )}
      </div>
    </div>
  );
}
