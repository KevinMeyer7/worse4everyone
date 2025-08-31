export type TBIssueRow = { issue_category: string; reports: number };

const TB_HOST =
  process.env.TB_HOST || "https://api.europe-west2.gcp.tinybird.co";
const TB_TOKEN = process.env.TB_TOKEN;

if (!TB_TOKEN) {
  // Don't crash at import time in Next.js, but log loudly.
  // The tRPC handler will throw a clean error if it's missing at call-time.
  console.warn("[Tinybird] Missing TB_TOKEN env var");
}

export async function fetchIssueBreakdown(params: {
  model: string;
  date_from?: string; // ISO string
  date_to?: string; // ISO string
}): Promise<TBIssueRow[]> {
  const url = new URL(`${TB_HOST}/v0/pipes/ai_issue_breakdown.json`);
  url.searchParams.set("model", params.model);
  if (params.date_from) url.searchParams.set("date_from", params.date_from);
  if (params.date_to) url.searchParams.set("date_to", params.date_to);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TB_TOKEN}` },
    // We want fresh data when demoing regressions
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[Tinybird] ${res.status} ${res.statusText}: ${text}`);
  }
  const json = (await res.json()) as { data: TBIssueRow[] };
  return json.data ?? [];
}
