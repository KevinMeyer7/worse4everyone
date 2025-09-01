"use client";

type Row = {
  issue_category: string;
  environment: string;
  cluster_key: string;
  cnt_w: number;
  cnt_n: number;
  example_details: string;
  last_seen: string;
};

export default function TopClustersTable({
  data,
  loading,
}: {
  data: Row[];
  loading?: boolean;
}) {
  if (loading)
    return (
      <div className="h-[280px] animate-pulse rounded-xl border border-border bg-background" />
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-foreground/70">
            <th className="py-2 pr-4">Issue</th>
            <th className="py-2 pr-4">Env</th>
            <th className="py-2 pr-4">Weighted</th>
            <th className="py-2 pr-4">Count</th>
            <th className="py-2 pr-4">Example</th>
            <th className="py-2 pr-4">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.cluster_key} className="border-b border-border/50">
              <td className="py-2 pr-4">{r.issue_category}</td>
              <td className="py-2 pr-4">{r.environment}</td>
              <td className="py-2 pr-4">{r.cnt_w.toFixed(1)}</td>
              <td className="py-2 pr-4">{r.cnt_n}</td>
              <td
                className="py-2 pr-4 max-w-[360px] truncate"
                title={r.example_details}
              >
                {r.example_details}
              </td>
              <td className="py-2 pr-4">
                {r.last_seen?.replace("T", " ").replace("Z", "")}
              </td>
            </tr>
          ))}
          {!data.length && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-foreground/70">
                No clusters detected.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
