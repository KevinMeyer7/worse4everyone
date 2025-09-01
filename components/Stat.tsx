"use client";

export default function Stat({
  label,
  value,
  hint,
  trend,
  help,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: "up" | "down" | "flat";
  help?: string;
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-background p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-xs text-foreground/60">
        <span>{label}</span>
        {help && (
          <button
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/80 text-[10px] leading-none"
            aria-label="Help"
            title={help}
          >
            ?
          </button>
        )}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs text-foreground/70">{hint}</div>}
      {trend && (
        <div
          className={`absolute right-3 top-3 h-2 w-2 rounded-full ${
            trend === "up"
              ? "bg-emerald-500"
              : trend === "down"
              ? "bg-rose-500"
              : "bg-amber-500"
          }`}
          aria-hidden
        />
      )}
    </div>
  );
}
