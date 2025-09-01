"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Sparkline, { type Point } from "@/components/Sparkline";
import { trpc } from "@/app/lib/trpc-client";
import { useMemo } from "react";

/** Minimal row the landing passes in (don’t require weighted counts here). */
export type ModelOverviewLike = {
  model: string;
  top_issue?: string | null;
  /** Optional: from ai_models_overview pipe. If present we’ll show it subtly. */
  today_reports?: number; // worse-weighted today (can be fractional)
};

/** Server shapes */
type VibePoint = { day: string; index_100: number };
type TodayIndexSummary = {
  today_index_100: number; // 0..100
  avg_prev_7d_index_100: number; // 0..100
  delta_index_pts: number; // today - baseline (points)
};

function statusFromIndex(idx?: number) {
  if (typeof idx !== "number")
    return { label: "Normal", tone: "normal" as const };
  if (idx >= 60) return { label: "Worse", tone: "worse" as const };
  if (idx <= 40) return { label: "Better", tone: "better" as const };
  return { label: "Normal", tone: "normal" as const };
}

function ToneBadge({
  tone,
  children,
}: {
  tone: "worse" | "normal" | "better";
  children: React.ReactNode;
}) {
  const cls =
    tone === "worse"
      ? "bg-rose-100 text-rose-700 border-rose-200"
      : tone === "better"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <Badge
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {tone === "worse" ? "⛔" : tone === "better" ? "✅" : "⏺"} {children}
    </Badge>
  );
}

export default function ModelCard({ o }: { o: ModelOverviewLike }) {
  // Pull normalized index summary for the card KPIs
  const { data: summaryData } = trpc.model.summary.useQuery(
    { model: o.model },
    { staleTime: 30_000, refetchOnWindowFocus: false }
  );
  const s = summaryData as TodayIndexSummary | undefined;

  // Pull normalized index series for the sparkline
  const { data: seriesData } = trpc.model.vibeSeries.useQuery(
    { model: o.model, days: 14 },
    { staleTime: 30_000, refetchOnWindowFocus: false }
  );
  const rows = (seriesData?.rows ?? []) as VibePoint[];

  // Map index -> sparkline's expected shape
  const points: Point[] = useMemo(
    () => rows.map((r) => ({ day: r.day, reports: r.index_100 ?? 50 })),
    [rows]
  );

  const todayIdx = s?.today_index_100 ?? 50;
  const base7Idx = s?.avg_prev_7d_index_100 ?? 50;
  const delta = s?.delta_index_pts ?? 0;
  const status = statusFromIndex(todayIdx);

  return (
    <Link href={`/models/${encodeURIComponent(o.model)}`} className="block">
      <Card className="transition hover:shadow-[0_0_20px_color-mix(in_srgb,var(--foreground)_12%,transparent)]">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="truncate">{o.model}</CardTitle>
            <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
          </div>
          <CardDescription>Top issue: {o.top_issue ?? "—"}</CardDescription>
        </CardHeader>

        <CardContent>
          {/* KPIs — all on 0..100 index scale */}
          <div className="mb-2 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border/60 bg-background/70 p-3">
              <div className="text-foreground/60">Today (Index)</div>
              <div className="font-mono text-base font-semibold">
                {Math.round(todayIdx)}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 p-3">
              <div className="text-foreground/60">7d baseline (Index)</div>
              <div className="font-mono text-base font-semibold">
                {Math.round(base7Idx)}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/70 p-3">
              <div className="text-foreground/60">Δ vs 7d (pts)</div>
              <div
                className={`font-mono text-base font-semibold ${
                  delta > 0
                    ? "text-emerald-600"
                    : delta < 0
                    ? "text-rose-600"
                    : ""
                }`}
              >
                {(delta >= 0 ? "+" : "") + delta.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Sparkline of index with neutral baseline */}
          <Sparkline data={points} baseline={50} />

          {/* Optional: tiny note with worse-weighted absolute for today if provided */}
          {typeof o.today_reports === "number" ? (
            <div className="mt-2 text-[11px] text-foreground/60">
              Worse-weighted today: {o.today_reports.toFixed(1)}
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-foreground/60">
              Index: 0–100 (50 = normal, higher = worse).
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
