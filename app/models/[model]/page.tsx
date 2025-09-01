"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "@/app/lib/trpc-client";

import Stat from "@/components/Stat";
import FiltersBar from "@/components/FiltersBar";
import VibeTimeseriesChart from "@/components/VibeTimeSeriesChart";
import IssueBreakdownChart from "@/components/IssueBreakdownChart";
import EnvBreakdownBar from "@/components/EnvBreakdownBar";
import RecentReports from "@/components/RecentReports";
import ReportIssueForm from "@/components/ReportIssueForm";
import TopClustersTable from "@/components/TopClustersTable";
import MetricsExplainer from "@/components/MetricsExplainer";

// --- UTC helpers (shared with FiltersBar semantics) ---
function isoNoMs(d: Date) {
  const s = d.toISOString();
  return s.replace(/\.\d{3}Z$/, "Z");
}
function startOfUTCDay(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function addDaysUTC(d: Date, days: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export default function ModelDetailPage() {
  const params = useParams<{ model?: string }>();
  const model = decodeURIComponent(params.model ?? "GPT-5");

  // Default: Last 30 days UTC, [from, to) where to = today 24:00Z
  const initialRange = useMemo(() => {
    const today00 = startOfUTCDay();
    const from = addDaysUTC(today00, -29);
    const to = addDaysUTC(today00, 1); // tomorrow 00:00Z exclusive
    return { from: isoNoMs(from), to: isoNoMs(to) };
  }, []);

  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);

  // Compute the window length in days to request from Tinybird (7..90)
  const daysRequested = useMemo(() => {
    const ms = Date.parse(dateTo) - Date.parse(dateFrom);
    const d = Math.max(1, Math.ceil(ms / 86_400_000));
    return Math.max(7, Math.min(90, d));
  }, [dateFrom, dateTo]);

  // KPIs: normalized index
  const summary = trpc.model.summary.useQuery({ model });

  // Timeseries: ask for days to match the current focus window (clamped)
  const vibe = trpc.model.vibeSeries.useQuery({
    model,
    days: daysRequested,
  });

  // Range-bound queries
  const breakdown = trpc.issue.breakdown.useQuery({
    model,
    date_from: dateFrom,
    date_to: dateTo,
  });
  const env = trpc.model.envBreakdown.useQuery({
    model,
    date_from: dateFrom,
    date_to: dateTo,
  });
  const clusters = trpc.model.topClusters.useQuery({
    model,
    date_from: dateFrom,
    date_to: dateTo,
    limit: 12,
  });
  const recent = trpc.model.recent.useQuery({ model, limit: 20 });

  const s = summary.data;
  const delta = s?.delta_index_pts ?? 0;
  const trend: "up" | "down" | "flat" =
    delta > 2 ? "up" : delta < -2 ? "down" : "flat";

  const onRefetchAll = () => {
    summary.refetch();
    vibe.refetch();
    breakdown.refetch();
    env.refetch();
    clusters.refetch();
    recent.refetch();
  };

  return (
    <section className="hacker relative min-h-dvh bg-background text-foreground font-mono">
      {/* CRT overlay */}
      <div
        className="crt pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      />

      <div className="mx-auto max-w-6xl px-6 pt-8 pb-16 space-y-6">
        {/* tiny terminal header */}
        <div className="mb-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2 text-sm text-foreground/80 shadow-[0_0_20px_color-mix(in_srgb,var(--foreground)_15%,transparent)]">
          ● ● ●{" "}
          <Link href="/" className="ml-2 hover:underline">
            you@host:~/worse4everyone/models/{model}
          </Link>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{model}</h1>
          <p className="text-sm text-foreground/70">
            Today’s worseness index vs 7-day baseline
          </p>
        </div>

        {/* KPIs (normalized, 0–100) */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label="Worseness Today (Index)"
            value={(s?.today_index_100 ?? 50).toFixed(0)}
            help="0–100 worseness index (≈50 baseline; higher is worse than usual)."
          />
          <Stat
            label="7d baseline (Index)"
            value={(s?.avg_prev_7d_index_100 ?? 50).toFixed(0)}
            help="Average of the last 7 days’ index values (excl. today)."
          />
          <Stat
            label="Δ vs 7d (pts)"
            value={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`}
            trend={trend}
            help="Difference in index points: today − 7-day baseline."
          />
        </div>

        {/* Filters */}
        <FiltersBar
          model={model}
          dateFrom={dateFrom}
          dateTo={dateTo}
          setModel={() => {}}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          onRefresh={onRefetchAll}
          isRefreshing={
            summary.isFetching ||
            vibe.isFetching ||
            breakdown.isFetching ||
            env.isFetching ||
            clusters.isFetching ||
            recent.isFetching
          }
        />

        {/* Vibe timeseries */}
        <div className="rounded-2xl border border-border bg-background p-5">
          <h3 className="mb-3 text-base font-semibold">
            Vibe over time ({daysRequested} days)
          </h3>
          {vibe.isLoading ? (
            <div className="h-[280px] animate-pulse rounded-xl border border-border bg-background" />
          ) : (vibe.data?.rows ?? []).length ? (
            <VibeTimeseriesChart
              data={vibe.data!.rows}
              focusFromISO={dateFrom}
              focusToISO={dateTo}
            />
          ) : (
            <div className="p-8 text-center text-foreground/70">No data.</div>
          )}
        </div>

        {/* Short explainer */}
        <MetricsExplainer />

        {/* Two-up: Issue pie + Env bar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-5">
            <h3 className="mb-3 text-base font-semibold">
              What’s wrong (weighted)
            </h3>
            {breakdown.isLoading ? (
              <div className="h-[280px] animate-pulse rounded-xl border border-border bg-background" />
            ) : (breakdown.data?.rows ?? []).length ? (
              <IssueBreakdownChart data={breakdown.data!.rows} />
            ) : (
              <div className="p-8 text-center text-foreground/70">
                No data for this range.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-background p-5 flex flex-col">
            <h3 className="mb-3 text-base font-semibold">
              Where it’s worse (weighted)
            </h3>
            {env.isLoading ? (
              <div className="h-[280px] animate-pulse rounded-xl border border-border bg-background" />
            ) : (env.data?.rows ?? []).length ? (
              <EnvBreakdownBar data={env.data!.rows} />
            ) : (
              <div className="p-8 text-center text-foreground/70">
                No data for this range.
              </div>
            )}
          </div>
        </div>

        {/* Two-up: Report form + Recent */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ReportIssueForm model={model} onSubmitted={onRefetchAll} />
          <RecentReports
            data={recent.data?.rows ?? []}
            loading={recent.isLoading}
          />
        </div>

        {/* Top clusters */}
        <div className="rounded-2xl border border-border bg-background p-5">
          <h3 className="mb-3 text-base font-semibold">
            Top incident clusters
          </h3>
          <TopClustersTable
            data={clusters.data?.rows ?? []}
            loading={clusters.isLoading}
          />
        </div>
      </div>
    </section>
  );
}
