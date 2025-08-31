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
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
      <div className="sm:col-span-1">
        <label className="text-xs font-medium text-slate-600">Model</label>
        <input
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400"
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

      <div className="sm:col-span-1">
        <label className="text-xs font-medium text-slate-600">From (ISO)</label>
        <input
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
      </div>

      <div className="sm:col-span-1">
        <label className="text-xs font-medium text-slate-600">To (ISO)</label>
        <input
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      <div className="sm:col-span-1">
        <label className="text-xs font-medium text-slate-600">Presets</label>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-slate-50"
            onClick={() => {
              setDateFrom(presets.last7.from);
              setDateTo(presets.last7.to);
            }}
          >
            Last 7d
          </button>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-slate-50"
            onClick={() => {
              setDateFrom(presets.last30.from);
              setDateTo(presets.last30.to);
            }}
          >
            Last 30d
          </button>
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm hover:bg-slate-50"
            onClick={() => {
              setDateFrom(presets.thisMonth.from);
              setDateTo(presets.thisMonth.to);
            }}
          >
            This month
          </button>

          <button
            onClick={onRefresh}
            className="ml-auto rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
    </div>
  );
}
