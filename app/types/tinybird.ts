export type IssueBreakdownRow = { issue_category: string; reports: number };
export type EnvBreakdownRow = { environment: string; reports: number };
export type VibePoint = {
  day: string; // 'YYYY-MM-DD'
  worse_w: number;
  better_w: number;
  net_w: number;
  index_100: number;
};

export type ModelOverviewRow = {
  model: string;
  today_reports: number; // weighted (kept for %, sorting)
  avg_prev_7d: number; // weighted 7d avg
  pct_vs_prev_7d: number;
  top_issue: string | null;

  today_count: number; // NEW: raw count (integer)
  avg_prev_7d_count: number; // NEW: raw 7d avg (float)
};
