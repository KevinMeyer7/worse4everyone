"use client";
import { useState } from "react";
import dayjs from "dayjs";

type Row = {
  timestamp: string;
  model: string;
  environment: string;
  issue_category: string;
  severity: string;
  repro: string;
  vibe: string;
  details?: string;
  source?: string;
};

export default function RecentReports({
  data,
  loading,
}: {
  data: Row[];
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (loading)
    return (
      <div className="h-[280px] animate-pulse rounded-xl border border-border bg-background" />
    );

  const visibleData = expanded ? data : data.slice(0, 3);

  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <h3 className="mb-3 text-base font-semibold">Recent reports</h3>
      <div className="space-y-3">
        {visibleData.map((r, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/70 bg-background/60 p-3"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-foreground/70">
              <span className="rounded bg-muted px-2 py-0.5">
                {r.environment}
              </span>
              <span className="rounded bg-muted px-2 py-0.5">
                {r.issue_category}
              </span>
              <span className="rounded bg-muted px-2 py-0.5">{r.severity}</span>
              <span className="rounded bg-muted px-2 py-0.5">{r.repro}</span>
              <span className="rounded bg-muted px-2 py-0.5">{r.vibe}</span>
              <span className="ml-auto">
                {dayjs(r.timestamp).format("YYYY-MM-DD HH:mm")}
              </span>
            </div>
            {r.details && <p className="text-sm">{r.details}</p>}
          </div>
        ))}

        {!data.length && (
          <div className="p-8 text-center text-foreground/70">Nothing yet.</div>
        )}
      </div>

      {data.length > 5 && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-4 w-full text-sm font-medium text-primary hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
