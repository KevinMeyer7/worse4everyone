"use client";

import Shell from "./components/Shell";
import FiltersBar from "./components/FiltersBar";
import IssueBreakdownChart from "./components/IssueBreakdownChart";
import { useEffect, useState } from "react";
import { trpc } from "./lib/trpc-client";

export default function Page() {
  const [model, setModel] = useState("GPT-5");
  const [dateFrom, setDateFrom] = useState("2025-08-01T00:00:00Z");
  const [dateTo, setDateTo] = useState("2025-08-31T00:00:00Z");

  const { data, isLoading, isFetching, isError, refetch } =
    trpc.issue.breakdown.useQuery(
      { model, date_from: dateFrom, date_to: dateTo }
    );

  useEffect(() => {
    refetch();
  }, [model, dateFrom, dateTo, refetch]);

  return (
    <Shell>
      <FiltersBar
        model={model}
        dateFrom={dateFrom}
        dateTo={dateTo}
        setModel={setModel}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      {isError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load. Check TB_HOST/TB_TOKEN.
        </div>
      )}

      {isLoading ? (
        <div className="h-[360px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
      ) : data?.rows?.length ? (
        <IssueBreakdownChart data={data.rows} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          No data for this range.
        </div>
      )}
    </Shell>
  );
}
