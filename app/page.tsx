"use client";

import ModelCard from "@/components/ModelCard";
import Stat from "@/components/Stat";
import { trpc } from "@/app/lib/trpc-client";

import RetroHero from "@/components/retro/RetroHero";
import { RetroPanel } from "@/components/ui/retro-panel";
import { RetroButton } from "@/components/ui/retro-button";
import SkeletonCard from "@/components/SkeletonCard";

export default function Landing() {
  const { data, isLoading, isError, refetch, isFetching } =
    trpc.model.listOverview.useQuery({ limit: 8 });

  // Quick aggregates
  const totals = (data?.rows ?? []).reduce(
    (acc, r) => {
      acc.today += r.today_reports;
      acc.avg7 += r.avg_prev_7d;
      return acc;
    },
    { today: 0, avg7: 0 }
  );
  const pct = totals.avg7
    ? ((totals.today - totals.avg7) / totals.avg7) * 100
    : 0;
  const trend = pct > 5 ? "up" : pct < -5 ? "down" : "flat";

  return (
    <div>
      {/* Scoped hacker theme. Everything inside inherits your token overrides */}
      <section className="hacker relative min-h-dvh bg-background text-foreground font-mono">
        {/* CRT scanlines + subtle glow, defined in globals for .hacker .crt */}
        <div className="crt absolute inset-0 -z-10 rounded-none" aria-hidden />

        {/* Top “terminal bar” */}
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <div className="mb-6 rounded-2xl border border-border/60 bg-background/60 px-4 py-2 text-sm text-foreground/80 shadow-[0_0_20px_color-mix(in_srgb,var(--foreground)_15%,transparent)]">
            ● ● ● <span className="ml-2">you@host:~/worse4everyone</span>
          </div>

          <RetroHero
            title="Is it worse for everyone or just me?"
            subtitle="Live signals from real users across popular AI models"
          >
            <RetroButton
              onClick={() => refetch()}
              loading={isFetching}
              className="border border-border bg-background text-foreground hover:opacity-90"
            >
              {isFetching ? (
                <>
                  Refreshing…{" "}
                  <span className="ml-1 inline-block h-[1.05em] w-[0.65ch] align-text-bottom cursor-block blink bg-foreground" />
                </>
              ) : (
                "Refresh"
              )}
            </RetroButton>
          </RetroHero>

          {/* KPIs */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat
              label="Reports today (top models)"
              value={totals.today.toLocaleString()}
              hint={`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs 7d avg`}
              trend={trend as "up" | "down" | "flat"}
            />
            <Stat
              label="Models monitored"
              value={(data?.rows?.length ?? 0).toString()}
            />
            <Stat
              label="Top issue today"
              value={data?.rows?.[0]?.top_issue ?? "—"}
            />
          </div>

          {/* Content panel header */}
          <RetroPanel className="mb-8 border border-border bg-background/50 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold tracking-wide text-foreground/80">
                $ ls models — click to deep-dive
              </h2>
              <span className="rounded-full border border-border/80 bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground/80">
                {totals.today.toLocaleString()} reports today
              </span>
            </div>
          </RetroPanel>

          {/* Errors / Loading / Grid */}
          {isError && (
            <div className="mb-4 rounded-xl border border-[color-mix(in_srgb,red_35%,transparent)] bg-[color-mix(in_srgb,red_12%,transparent)] px-4 py-3 text-sm text-[color-mix(in_srgb,red_80%,#000)]">
              Failed to load. Check TB_HOST/TB_TOKEN.
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.rows ?? []).map((o) => (
                <ModelCard key={o.model} o={o} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
