"use client";
import { useMemo } from "react";

function iso(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
function startOfUTCDay(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}
function endOfUTCDay(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export type Filters = {
  model: string;
  dateFrom: string;
  dateTo: string;
  setModel: (v: string) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

export default function FiltersBar(props: Filters) {
  const {
    model,
    dateFrom,
    dateTo,
    setModel,
    setDateFrom,
    setDateTo,
    onRefresh,
    isRefreshing,
  } = props;

  const presets = useMemo(() => {
    const today = startOfUTCDay();
    const last7 = new Date(today);
    last7.setUTCDate(today.getUTCDate() - 6);
    const last30 = new Date(today);
    last30.setUTCDate(today.getUTCDate() - 29);
    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
    );
    return {
      last7: { from: iso(last7), to: iso(endOfUTCDay(today)) },
      last30: { from: iso(last30), to: iso(endOfUTCDay(today)) },
      thisMonth: { from: iso(monthStart), to: iso(endOfUTCDay(today)) },
    };
  }, []);

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4 font-mono">
      {/* Model */}
      <div className="sm:col-span-1">
        <label className="text-xs font-medium text-foreground/70">Model</label>
        <input
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          list="models"
          placeholder="GPT-5"
        />
        <datalist id="models">
          <option>GPT-5</option>
          <option>GPT-4o</option>
          <option>Claude 3.7</option>
          <option>Gemini 2.0</option>
        </datalist>
      </div>

      {/* From */}
      <div className="sm:col-span-1">
        <label className="text-xs font-medium text-foreground/70">
          From (ISO)
        </label>
        <input
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
      </div>

      {/* To */}
      <div className="sm:col-span-1">
        <label className="text-xs font-medium text-foreground/70">
          To (ISO)
        </label>
        <input
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {/* Presets + Refresh */}
      <div className="sm:col-span-1">
        <label className="text-xs font-medium text-foreground/70">
          Presets
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]"
            onClick={() => {
              setDateFrom(presets.last7.from);
              setDateTo(presets.last7.to);
            }}
          >
            Last 7d
          </button>
          <button
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]"
            onClick={() => {
              setDateFrom(presets.last30.from);
              setDateTo(presets.last30.to);
            }}
          >
            Last 30d
          </button>
          <button
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]"
            onClick={() => {
              setDateFrom(presets.thisMonth.from);
              setDateTo(presets.thisMonth.to);
            }}
          >
            This month
          </button>

          <button
            onClick={onRefresh}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground shadow-sm hover:opacity-90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--foreground)_30%,transparent)]"
            disabled={isRefreshing}
            aria-busy={isRefreshing}
          >
            {isRefreshing ? (
              <>
                Refreshing…
                <span className="cursor-block blink inline-block h-[1.05em] w-[0.65ch] translate-y-[1px] bg-foreground" />
              </>
            ) : (
              "Refresh"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
