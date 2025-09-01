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

/** Small helper to detect mobile (client-only, avoids SSR mismatches) */
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width:${breakpoint}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsMobile("matches" in e ? e.matches : (e as MediaQueryList).matches);
    onChange(mql);
    if ("addEventListener" in mql) {
      mql.addEventListener(
        "change",
        onChange as (e: MediaQueryListEvent) => void
      );
      return () =>
        mql.removeEventListener(
          "change",
          onChange as (e: MediaQueryListEvent) => void
        );
    } else {
      (mql as MediaQueryList).addListener(onChange);
      return () => {
        (mql as MediaQueryList).removeListener(onChange);
      };
    }
  }, [breakpoint]);
  return isMobile;
}

/** Custom label with leader line (desktop only) */
interface SliceLabelProps extends PieLabelRenderProps {
  payload: Row;
  value: number;
  index: number;
  outerRadius: number;
  cutoff?: number; // e.g. 0.05 = 5%
}

function renderSliceLabel(props: SliceLabelProps) {
  const {
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
    index,
    payload,
    value,
    cutoff,
  } = props;

  // Hide small slices to reduce clutter
  const minCutoff = typeof cutoff === "number" ? cutoff : 0.05;
  if (percent === undefined || percent < minCutoff) return null;

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

  // Derive display name and truncate Context Memory specifically
  const rawName: string =
    payload.issue_tag ??
    payload.issue_category ??
    payload.name ??
    `Slice ${index + 1}`;
  const name = rawName === "Context Memory" ? "Context Mem" : rawName;

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
  const isMobile = useIsMobile(640);
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

  // Global rule (mobile + desktop): hide ALL slices under 5%
  const displayData = withPct.filter((d) => d.pct >= 5);

  // Mobile-friendly sizing & margins; labels are off on mobile
  const chartHeight = isMobile ? 420 : 360;
  const pieInner = isMobile ? 64 : 80;
  const pieOuter = isMobile ? 100 : 120;
  const chartMargin = isMobile
    ? { top: 16, right: 72, bottom: 16, left: 72 }
    : { top: 24, right: 48, bottom: 24, left: 48 };

  const hasDisplayData = mounted && total > 0 && displayData.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-background p-4 sm:p-6 text-foreground shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Issue breakdown</h2>
          <p className="text-xs sm:text-sm text-foreground/70">
            Share of reports by category
            {mode === "weighted" ? " (weighted)" : " (raw)"}
          </p>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 text-right text-xs sm:text-sm text-foreground/80">
          <div>
            Total: <span className="font-medium">{total.toLocaleString()}</span>
          </div>
          {showModeToggle && (
            <div className="rounded-lg border border-border overflow-hidden">
              <button
                className={`px-2 py-1 text-[11px] sm:text-xs ${
                  mode === "raw" ? "bg-muted/60" : ""
                }`}
                onClick={() => setMode("raw")}
              >
                Raw
              </button>
              <button
                className={`px-2 py-1 text-[11px] sm:text-xs border-l border-border ${
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

      <div
        style={{ width: "100%", height: chartHeight, overflow: "visible" }}
        className="sm:overflow-visible"
      >
        {hasDisplayData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={chartMargin}>
              <Pie
                data={displayData}
                dataKey="value"
                nameKey="name"
                innerRadius={pieInner}
                outerRadius={pieOuter}
                startAngle={90}
                endAngle={-270}
                stroke="var(--border)"
                strokeWidth={2}
                paddingAngle={1}
                cornerRadius={2}
                isAnimationActive={true}
                labelLine={false}
                // Desktop: show smart labels; Mobile: NO labels at all
                label={
                  isMobile
                    ? false
                    : (props: PieLabelRenderProps) =>
                        typeof props.midAngle === "number"
                          ? renderSliceLabel({
                              ...(props as SliceLabelProps),
                              cutoff: 0.05, // keep ≥5% rule even for label renderer
                            })
                          : null
                }
              >
                {displayData.map((_, i) => (
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
                          className="fill-current text-foreground text-xl sm:text-2xl font-bold"
                        >
                          {total.toLocaleString()}
                        </text>
                        <text
                          x={cx}
                          y={cy + 14}
                          textAnchor="middle"
                          className="fill-current text-foreground/60 text-[10px] sm:text-xs"
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
            {mounted && total > 0
              ? "No categories ≥ 5% to display."
              : "No data."}
          </div>
        )}
      </div>

      {/* Legend ONLY on mobile; desktop relies on in-chart labels */}
      {mounted && total > 0 && isMobile && displayData.length > 0 && (
        <div className="mt-4 sm:mt-6">
          <p className="mb-2 text-[10px] text-foreground/60">
            Showing categories ≥ 5% on small screens.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {displayData.map((row, i) => (
              <li
                key={`${row.name}-${i}`}
                className="flex items-center justify-between gap-3 text-xs sm:text-sm"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                    aria-hidden
                  />
                  <span className="truncate" title={row.name}>
                    {row.name}
                  </span>
                </span>
                <span className="tabular-nums text-foreground/70 shrink-0">
                  {row.value.toLocaleString()} • {row.pct.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
