"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Return a new Date that is UTC Y/M/D 00:00:00.000 based on given Date (ignores local tz). */
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
function isoNoMs(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Combine a UTC day (date part) with hour/min to a UTC Date. */
function atUTCHourMin(day: Date, hh: number, mm: number) {
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      hh,
      mm,
      0,
      0
    )
  );
}

export type Filters = {
  model: string;
  dateFrom: string; // ISO Z (inclusive)
  dateTo: string; // ISO Z (exclusive)
  setModel: (v: string) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

const KNOWN_MODELS = ["GPT-5", "GPT-4o", "Claude 3.7", "Gemini 2.5", "Grok-3"];

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

  const router = useRouter();

  // ---- Calendar popover state ----
  const [open, setOpen] = useState(false);

  // Current range as DateRange (UTC dates, day precision)
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    // `dateTo` is exclusive; show (to - 1 day) as the end date in calendar for full days.
    const toDisplay = addDaysUTC(to, -1);
    return { from: startOfUTCDay(from), to: startOfUTCDay(toDisplay) };
  });

  // Time-of-day (UTC) pickers for more granularity
  const [fromHH, setFromHH] = useState(0);
  const [fromMM, setFromMM] = useState(0);
  const [toHH, setToHH] = useState(0);
  const [toMM, setToMM] = useState(0);

  // Keep calendar in sync if parent changes externally
  useEffect(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    setRange({
      from: startOfUTCDay(from),
      to: startOfUTCDay(addDaysUTC(to, -1)),
    });
    setFromHH(new Date(dateFrom).getUTCHours());
    setFromMM(new Date(dateFrom).getUTCMinutes());
    setToHH(new Date(dateTo).getUTCHours());
    setToMM(new Date(dateTo).getUTCMinutes());
  }, [dateFrom, dateTo]);

  // Debounce refresh when ISO changes (so presets click updates the graph automatically)
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => onRefresh(), 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => [0, 15, 30, 45], []);

  // Presets (UTC half-open [from, to))
  const presets = useMemo(() => {
    const today00 = startOfUTCDay();
    const tomorrow00 = addDaysUTC(today00, 1);
    const yesterday00 = addDaysUTC(today00, -1);

    const last7_from = addDaysUTC(today00, -6);
    const last14_from = addDaysUTC(today00, -13);
    const last30_from = addDaysUTC(today00, -29);

    const monthStart = new Date(
      Date.UTC(today00.getUTCFullYear(), today00.getUTCMonth(), 1)
    );
    const nextMonthStart = new Date(
      Date.UTC(today00.getUTCFullYear(), today00.getUTCMonth() + 1, 1)
    );
    const prevMonthStart = new Date(
      Date.UTC(today00.getUTCFullYear(), today00.getUTCMonth() - 1, 1)
    );

    return {
      Today: { from: today00, to: tomorrow00 },
      Yesterday: { from: yesterday00, to: today00 },
      "Last 7d": { from: last7_from, to: tomorrow00 },
      "Last 14d": { from: last14_from, to: tomorrow00 },
      "Last 30d": { from: last30_from, to: tomorrow00 },
      "This month": { from: monthStart, to: nextMonthStart },
      "Prev month": { from: prevMonthStart, to: monthStart },
    } as Record<string, { from: Date; to: Date }>;
  }, []);

  function applyRange(from: Date, to: Date) {
    // Respect time pickers (UTC). `to` remains exclusive.
    const fromFinal = atUTCHourMin(from, fromHH, fromMM);
    const toFinal = atUTCHourMin(to, toHH, toMM);

    // Ensure [from, to) valid; if not, bump to by +1h
    const finalFrom = fromFinal;
    let finalTo = toFinal;
    if (finalTo <= finalFrom) {
      finalTo = new Date(finalFrom.getTime() + 60 * 60 * 1000);
      setToHH(finalTo.getUTCHours());
      setToMM(finalTo.getUTCMinutes());
    }

    setDateFrom(isoNoMs(finalFrom));
    setDateTo(isoNoMs(finalTo));
  }

  function onApplyClick() {
    if (!range?.from || !range?.to) return;
    // Calendar range is inclusive on both ends; transform to half-open by adding +1 day to end date
    const toExclusive = addDaysUTC(range.to, 1);
    applyRange(range.from, toExclusive);
    setOpen(false);
  }

  function quickPreset(label: string) {
    const p = presets[label];
    setRange({ from: p.from, to: addDaysUTC(p.to, -1) });
    // default full-day times
    setFromHH(0);
    setFromMM(0);
    setToHH(0);
    setToMM(0);
    setDateFrom(isoNoMs(p.from));
    setDateTo(isoNoMs(p.to));
  }

  function changeModel(next: string) {
    const m = next.trim();
    if (!m) return;
    setModel(m);
    router.push(`/models/${encodeURIComponent(m)}`);
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-5 font-mono">
      {/* Model picker (single select) */}
      <div className="sm:col-span-1">
        <label className="text-xs font-medium text-foreground/70">Model</label>
        <select
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none"
          value={model}
          onChange={(e) => changeModel(e.target.value)}
        >
          {KNOWN_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Date range picker (calendar + times) */}
      <div className="sm:col-span-4">
        <label className="text-xs font-medium text-foreground/70">
          Date range (UTC)
        </label>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {/* Trigger */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-sm hover:opacity-90"
          >
            {new Date(dateFrom).toISOString().slice(0, 16).replace("T", " ")}Z
            {"  →  "}
            {new Date(dateTo).toISOString().slice(0, 16).replace("T", " ")}Z
          </button>

          {/* Presets */}
          {Object.keys(presets).map((label) => (
            <button
              key={label}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground shadow-sm hover:opacity-90"
              onClick={() => quickPreset(label)}
            >
              {label}
            </button>
          ))}

          <button
            onClick={onRefresh}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-1.5 text-xs font-medium text-foreground shadow-sm hover:opacity-90 disabled:opacity-60 focus:outline-none"
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            title="Force refresh"
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

        {/* Popover */}
        {open && (
          <div className="relative z-10 mt-2">
            <div className="rounded-xl border border-border bg-background p-3 shadow-xl">
              <div className="flex flex-col gap-3 md:flex-row">
                {/* Calendar */}
                <DayPicker
                  mode="range"
                  selected={range}
                  onSelect={(r) => setRange(r)}
                  defaultMonth={range?.from ?? startOfUTCDay()}
                  weekStartsOn={1}
                  numberOfMonths={2}
                  className="text-sm"
                />

                {/* Time controls */}
                <div className="w-full md:w-64 space-y-3">
                  <div>
                    <div className="mb-1 text-xs text-foreground/70">
                      Start time (UTC)
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="w-full rounded-md border border-border bg-background p-2 text-sm"
                        value={fromHH}
                        onChange={(e) => setFromHH(Number(e.target.value))}
                      >
                        {hours.map((h) => (
                          <option key={h} value={h}>
                            {pad(h)}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full rounded-md border border-border bg-background p-2 text-sm"
                        value={fromMM}
                        onChange={(e) => setFromMM(Number(e.target.value))}
                      >
                        {minutes.map((m) => (
                          <option key={m} value={m}>
                            {pad(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-foreground/70">
                      End time (UTC, exclusive)
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="w-full rounded-md border border-border bg-background p-2 text-sm"
                        value={toHH}
                        onChange={(e) => setToHH(Number(e.target.value))}
                      >
                        {hours.map((h) => (
                          <option key={h} value={h}>
                            {pad(h)}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full rounded-md border border-border bg-background p-2 text-sm"
                        value={toMM}
                        onChange={(e) => setToMM(Number(e.target.value))}
                      >
                        {minutes.map((m) => (
                          <option key={m} value={m}>
                            {pad(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:opacity-90"
                      disabled={!range?.from || !range?.to}
                      onClick={onApplyClick}
                    >
                      Apply range
                    </button>
                    <button
                      className="ml-auto rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:opacity-90"
                      onClick={() => setOpen(false)}
                    >
                      Close
                    </button>
                  </div>

                  <p className="text-[11px] text-foreground/60">
                    Queries use a half-open range <code>[from, to)</code> in
                    UTC. If <em>to</em> ≤ <em>from</em>, we auto-bump{" "}
                    <em>to</em> by 1h.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
