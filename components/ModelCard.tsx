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

export type ModelOverview = {
  model: string;
  today_reports: number;
  avg_prev_7d: number;
  pct_vs_prev_7d: number; // +/- %
  top_issue: string | null;
};

// A lightweight structural type to safely read the y-value regardless of
// the server's exact key naming (reports/count/value).
type VibeRowLike = {
  day: string;
} & Partial<Record<"reports" | "count" | "value", number>>;

export default function ModelCard({ o }: { o: ModelOverview }) {
  const trend: "up" | "down" | "flat" =
    o.pct_vs_prev_7d > 5 ? "up" : o.pct_vs_prev_7d < -5 ? "down" : "flat";

  const { data } = trpc.model.timeseries.useQuery({ model: o.model, days: 14 });

  // Adapt the TRPC series rows to the Sparkline's Point[] shape (day/reports).
  const sparkPoints: Point[] = useMemo(() => {
    const rows = (data?.series ?? []) as unknown as VibeRowLike[];
    return rows.map((r) => {
      const y =
        typeof r.reports === "number"
          ? r.reports
          : typeof r.count === "number"
          ? r.count
          : typeof r.value === "number"
          ? r.value
          : 0;
      return { day: r.day, reports: y };
    });
  }, [data?.series]);

  return (
    <Link href={`/models/${encodeURIComponent(o.model)}`} className="block">
      <Card className="transition hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="truncate">{o.model}</CardTitle>
            <Badge
              className={
                trend === "up"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                  : trend === "down"
                  ? "bg-rose-50 border border-rose-200 text-rose-700"
                  : ""
              }
            >
              {trend === "up"
                ? "Worse today"
                : trend === "down"
                ? "Better today"
                : "Normal"}
            </Badge>
          </div>
          <CardDescription>Top issue: {o.top_issue ?? "—"}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-semibold">
              {o.today_reports.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">today</div>
            <div className="ml-auto text-xs text-slate-600">
              7d avg:{" "}
              <span className="font-medium">{o.avg_prev_7d.toFixed(1)}</span>
              <span
                className={
                  "ml-2 font-medium " +
                  (trend === "up"
                    ? "text-emerald-600"
                    : trend === "down"
                    ? "text-rose-600"
                    : "text-slate-600")
                }
              >
                {o.pct_vs_prev_7d >= 0 ? "+" : ""}
                {o.pct_vs_prev_7d.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="mt-2">
            <Sparkline data={sparkPoints} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
