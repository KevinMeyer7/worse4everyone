// app/types/tinybird.ts

export type ModelOverviewRow = {
  model: string;
  today_reports: number; // worse-weighted “today”
  avg_prev_7d: number; // worse-weighted 7d average
  pct_vs_prev_7d: number; // percentage change vs 7d average
  top_issue: string | null; // top issue tag (issue_tags[] or fallback issue_category)
};

// (you can keep other TB types here too, e.g. for issues/env)
export type IssueBreakdownRow = { issue_category: string; reports: number };
export type EnvBreakdownRow = { environment: string; reports: number };
export type VibePoint = {
  day: string; // 'YYYY-MM-DD'
  worse_w: number;
  better_w: number;
  net_w: number;
  index_100: number; // 0..100
};
