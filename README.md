# Worse4Everyone

## What is this?

Worse4Everyone tracks **"vibe changes"** in frontier LLMs across products and developer surfaces. It blends:

- **Implicit signals** (search/telemetry) and **explicit reports** (user form)
- A **0–100 "Worseness Index"** (normalized, comparable)
- **Weighted counts** by issue and environment

**You get:**
- Today vs 7-day baseline
- A clear time-series
- Where things are breaking
- Top incident clusters with examples

---

## Why this design?

- **Normalize to 0–100**  
  Raw complaint counts don’t travel across models with different volume. A z-score-like index does.

- **Weight by severity × reproducibility**  
  A one-off minor hiccup shouldn’t outweigh a blocking regression that reproduces always.

- **Two data streams (implicit + explicit)**  
  Users search when something feels off; explicit reports add precision. We combine both.

- **Model-aware inputs**  
  “Where did this happen?” is different for GPT vs Gemini vs Claude vs Grok, so the form & seed reflect that.

---

## Key metric (Worseness Index, 0–100)

**Per model, per day:**

```text
weight   = severity_weight × repro_weight
worse_w  = Σ weight where vibe='worse'
better_w = Σ weight where vibe='better'
net_w    = worse_w - better_w
mean_28  = 28-day rolling mean of net_w (prior days only)
std_28   = 28-day rolling stddev (prior days only)
scale    = std_28; if 0/NULL, fallback to (avg abs deviation × 1.253), min 1

index_100 = clamp(0, 100, 50 + 15 × (net_w - mean_28) / scale)
```

### Interpretation

- **50** ≈ baseline  
- **>50** worse than usual  
- **<50** better than usual  

### Severity weights

- minor `0.5`
- noticeable `1.0`
- major `1.6`
- blocking `2.5`

### Repro weights

- once `0.3`
- sometimes `0.6`
- often `0.9`
- always `1.0`

---

## Data model (Tinybird)

### Datasources (identical schema)

- **ai_model_signals** (implicit)
- **ai_user_feedback** (explicit)

```text
timestamp DateTime
model LowCardinality(String)
environment LowCardinality(String)             -- e.g. "ChatGPT Web (chat.openai.com)"
environment_version LowCardinality(String)
mode LowCardinality(String)                    -- text|code|image|audio|multimodal
issue_category LowCardinality(String)
issue_tags Array(String)
severity LowCardinality(String)                -- minor|noticeable|major|blocking
repro LowCardinality(String)                   -- once|sometimes|often|always
vibe LowCardinality(String)                    -- worse|better|normal
details String
user_agent String
ip_address String
location LowCardinality(String)                -- ISO-2
source LowCardinality(String)                  -- seed|web|user
latency_ms UInt32
http_status UInt16
error_code LowCardinality(String)
```

### Pipes (endpoints) (high-level)

- **ai_model_vibe_timeseries** → day, worse_w, better_w, net_w, index_100
- **ai_model_today_index** → today_index_100, avg_prev_7d_index_100, delta_index_pts
- **ai_issue_breakdown** → issue_category, weighted share
- **ai_env_breakdown** → environment, weighted share
- **ai_models_overview** → model, today (weighted), 7d avg, % vs 7d, top_issue
- **ai_top_clusters** → cluster_key, example, last_seen (dedupe by normalized text + dims)
- **ai_recent_reports** → most recent explicit/implicit rows

---

## Run it locally (quick)

### Environment

```bash
# Tinybird
export TB_TOKEN=...                 # admin or read token for pipes
export TB_EVENTS_TOKEN=...          # events token for ingest
export TB_API_BASE=https://api.europe-west2.gcp.tinybird.co

# App
cp .env.example .env.local          # fill TB_* vars for tRPC server
```

### Deploy Tinybird artifacts

```bash
tb --max-depth 5 build && tb --max-depth 5 --cloud deploy
```

### Seed

```bash
ts-node scripts/seed_v3.ts  # knobs: DAYS, RPD_SIGNALS, RPD_FEEDBACK, MIN_TOTAL, CUTOFF_HOUR_UTC…
```

### Start app

```bash
pnpm dev    # or yarn dev / npm run dev
```

---

## Reading the UI

- **Model cards**
  - Worseness Index sparkline (last 14d)
  - Badge = Worse / Normal / Better today vs 7d
  - Top issue tag

- **Model page**
  - **Stats:** Today Index, 7-day baseline Index, Δ vs 7d (points)
  - **Vibe over time:** Toggle Index (0–100) or Counts (worse, better, net)
  - **Issue breakdown (pie):** Weighted shares by issue
  - **Environment breakdown (bar):** Weighted shares by product/surface
  - **Top clusters:** De-duplicated incident clusters with example excerpts
  - **Report a vibe change:** Model-aware environment list + compact fields

---

## Troubleshooting

- **Quarantined events:**  
  Ensure `issue_tags` maps with `json:$.issue_tags[:]` in schema and you `POST []` if empty.  
  `Content-Type` must be `application/x-ndjson`, newline-terminated.

- **Windows after WINDOW:**  
  In ClickHouse SQL (Tinybird), apply `WHERE` outside the subquery that defines `WINDOW`.

- **Non-integer "reports today":**  
  That’s weighted points, not raw counts. The Index is normalized for human comparison.
