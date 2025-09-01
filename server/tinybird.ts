import { ModelOverviewRow } from "@/app/types/tinybird";

// server/tinybird.ts
type TBJson<T> = { data: T[] };

export type TVibeRow = {
  day: string; // YYYY-MM-DD
  worse_w: number;
  better_w: number;
  net_w: number;
  index_100?: number; // 0–100 index
};

export type TSummaryIndex = {
  today_index_100: number;
  avg_prev_7d_index_100: number;
  delta_index_pts: number;
};

export type TIssueRow = {
  issue_tag: string;
  reports_w: number; // weighted worse
  reports_n: number; // raw worse count (informational)
  pct_w: number; // percent of weighted worse
};

export type TEnvRow = {
  environment: string;
  reports_w: number;
  pct_w: number;
};

export type TClusterRow = {
  issue_category: string;
  environment: string;
  cluster_key: string;
  cnt_w: number;
  cnt_n: number;
  example_details: string;
  last_seen: string; // ISO datetime
};

export type TRecentRow = {
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

export type TOverviewRow = {
  model: string;
  today_index_100: number;
  avg_prev_7d_index_100: number;
  delta_index_pts: number;
};

const TB_HOST =
  process.env.TB_HOST || "https://api.europe-west2.gcp.tinybird.co";
const TB_TOKEN = process.env.TB_TOKEN;
const TB_EVENTS_TOKEN = process.env.TB_EVENTS_TOKEN;
const TB_API_BASE = process.env.TB_API_BASE || TB_HOST;

/** Raw pipes fetch */
async function tbPipe<T>(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<T[]> {
  if (!TB_TOKEN) throw new Error("Missing TB_TOKEN");
  const url = new URL(`${TB_HOST}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${TB_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`[Tinybird] ${res.status}: ${await res.text()}`);
  const json: TBJson<T> = await res.json();
  return json.data ?? [];
}

export async function fetchModelTodayIndex(
  model: string
): Promise<TSummaryIndex> {
  const rows = await tbPipe<TSummaryIndex>(
    "/v0/pipes/ai_model_today_index.json",
    { model }
  );

  console.log("rows:", rows);
  return (
    rows[0] || {
      today_index_100: 0,
      avg_prev_7d_index_100: 0,
      delta_index_pts: 0,
    }
  );
}

export async function fetchVibeTimeseries(
  model: string,
  days: number
): Promise<TVibeRow[]> {
  return tbPipe<TVibeRow>("/v0/pipes/ai_model_vibe_timeseries.json", {
    model,
    days,
  });
}

export async function fetchIssueBreakdown(
  model: string,
  date_from?: string,
  date_to?: string
): Promise<TIssueRow[]> {
  return tbPipe<TIssueRow>("/v0/pipes/ai_issue_breakdown.json", {
    model,
    date_from,
    date_to,
  });
}

export async function fetchEnvBreakdown(
  model: string,
  date_from?: string,
  date_to?: string
): Promise<TEnvRow[]> {
  return tbPipe<TEnvRow>("/v0/pipes/ai_env_breakdown.json", {
    model,
    date_from,
    date_to,
  });
}

export async function fetchTopClusters(
  model: string,
  date_from?: string,
  date_to?: string,
  limit = 20
): Promise<TClusterRow[]> {
  return tbPipe<TClusterRow>("/v0/pipes/ai_top_clusters.json", {
    model,
    date_from,
    date_to,
    limit,
  });
}

export async function fetchRecentReports(
  model: string,
  limit = 20
): Promise<TRecentRow[]> {
  return tbPipe<TRecentRow>("/v0/pipes/ai_recent_reports.json", {
    model,
    limit,
  });
}

export async function fetchModelsOverviewIndex(
  limit = 8
): Promise<ModelOverviewRow[]> {
  // Pipe: ai_models_overview.json
  return tbPipe<ModelOverviewRow>("/v0/pipes/ai_models_overview.json", {
    limit,
  });
}
/** Submit user feedback to Events API (ai_user_feedback) */
export async function submitFeedback(input: {
  model: string;
  environment: string;
  issue_category: string;
  issue_tags?: string[];
  severity: "minor" | "noticeable" | "major" | "blocking";
  repro: "once" | "sometimes" | "often" | "always";
  vibe: "worse" | "better" | "normal";
  details?: string;
  location?: string;
  environment_version?: string;
  mode?: string;
  user_agent?: string;
  ip_address?: string;
}) {
  if (!TB_EVENTS_TOKEN) throw new Error("Missing TB_EVENTS_TOKEN");
  const body =
    JSON.stringify({
      timestamp: new Date().toISOString(),
      source: "user",
      ...input,
      // Ensure array form even if undefined (ClickHouse JSON path for arrays needs [])
      issue_tags: input.issue_tags ?? [],
    }) + "\n";

  const url = `${TB_API_BASE}/v0/events?name=ai_user_feedback&wait=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TB_EVENTS_TOKEN}`,
      "Content-Type": "application/x-ndjson",
    },
    body,
  });

  // const bodyText = await res.text();
  /*   console.log("[TB events] status", res.status, "body:", bodyText);

  console.log("res:", res); */
  if (!res.ok) {
    throw new Error(`[Tinybird Events] ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
