/* Seed Tinybird (v3): realistic mock data aligned to the simplified, model-aware form
   - ai_model_signals (implicit searches/telemetry)
   - ai_user_feedback (explicit user reports)

   Schema fields (both tables):
     timestamp, model, environment, environment_version, mode,
     issue_category, issue_tags[], severity, repro, vibe,
     details, user_agent, ip_address, location, source,
     latency_ms, http_status, error_code

   ---- Run (Local) ----
     export TB_EVENTS_TOKEN='p.<local-token>'               # Events token or Admin
     export TB_API_BASE='http://localhost:7181'
     ts-node scripts/seed_v3.ts

   ---- Run (Cloud, europe-west2) ----
     export TB_EVENTS_TOKEN='p.<cloud-token>'               # from `tb --cloud token copy <ID>`
     export TB_API_BASE='https://api.europe-west2.gcp.tinybird.co'
     ts-node scripts/seed_v3.ts

   Useful knobs:
     DAYS=45 RPD_SIGNALS=220 RPD_FEEDBACK=40 MIN_TOTAL=5000
     BATCH=1000 SPIKES=1 SEED=42 DRY_RUN=0
     MODELS="GPT-5,GPT-4o,Gemini 2.5,Claude 3.7,Grok-3"
     MODEL_SKEW=1.45 ISSUE_SKEW=1.25
     CUTOFF_HOUR_UTC=12        # latest day stops at HH:59 to match your demo window
     PURGE=0 NO_SQL_PREFLIGHT=0
*/

import fs from "node:fs/promises";

/* -------------------- Types -------------------- */
type Common = {
  timestamp?: string;
  model: string;
  environment: string;
  environment_version?: string;
  mode: "text" | "code" | "image" | "audio" | "multimodal";
  issue_category: string;
  issue_tags: string[];
  severity: "minor" | "noticeable" | "major" | "blocking";
  repro: "once" | "sometimes" | "often" | "always";
  vibe: "worse" | "better" | "normal";
  details?: string;
  user_agent?: string;
  ip_address?: string;
  location?: string; // ISO-2
  source?: string;
  latency_ms?: number;
  http_status?: number;
  error_code?: string;
};

type RowSignals = Common & {};
type RowFeedback = Common & {};

/* -------------------- Env config -------------------- */
const TB_API_BASE =
  process.env.TB_API_BASE ||
  (process.env.TB_API_REGION
    ? {
        "gcp-europe-west2": "https://api.europe-west2.gcp.tinybird.co",
        "gcp-us-central1": "https://api.us-central1.gcp.tinybird.co",
        "aws-us-east-1": "https://api.us-east-1.aws.tinybird.co",
        "aws-eu-west-1": "https://api.eu-west-1.aws.tinybird.co",
      }[process.env.TB_API_REGION]
    : "http://localhost:7181");

const TB_EVENTS_TOKEN = process.env.TB_EVENTS_TOKEN || "";
if (!TB_EVENTS_TOKEN) {
  console.error("Missing TB_EVENTS_TOKEN (Events or Admin token required)");
  process.exit(1);
}

const DS_SIGNALS = process.env.DS_SIGNALS || "ai_model_signals";
const DS_FEEDBACK = process.env.DS_FEEDBACK || "ai_user_feedback";

const NO_SQL_PREFLIGHT = (process.env.NO_SQL_PREFLIGHT ?? "0") === "1";
const PURGE = (process.env.PURGE ?? "0") === "1";

/** Latest day cutoff (UTC). Your demo expects data only up to this hour today. */
const CUTOFF_HOUR_UTC = Math.min(
  23,
  Math.max(1, Number(process.env.CUTOFF_HOUR_UTC ?? 12))
);

/* -------------------- Volume & behavior knobs -------------------- */
const DAYS = Number(process.env.DAYS ?? 35);
const RPD_SIGNALS = Number(process.env.RPD_SIGNALS ?? 220);
const RPD_FEEDBACK = Number(process.env.RPD_FEEDBACK ?? 40);
const MIN_TOTAL = Number(process.env.MIN_TOTAL ?? 5000);
const BATCH_SIZE = Number(process.env.BATCH ?? 1000);
const WITH_SPIKES = (process.env.SPIKES ?? "1") === "1";
const DRY_RUN = (process.env.DRY_RUN ?? "0") === "1";
const MAX_RETRIES = Number(process.env.RETRIES ?? 5);
const SEED = Number(process.env.SEED ?? Date.now());

/* -------------------- Models list -------------------- */
const MODELS = (
  process.env.MODELS ?? "GPT-5,GPT-4o,Gemini 2.5,Claude 3.7,Grok-3"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* -------------------- RNG -------------------- */
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
function rand<T>(arr: T[]): T {
  return arr[(rnd() * arr.length) | 0];
}
const randInt = (a: number, b: number) => a + ((rnd() * (b - a + 1)) | 0);

/* -------------------- Distributions & helpers -------------------- */
const MODEL_SKEW = Number(process.env.MODEL_SKEW ?? 1.45);
const ISSUE_SKEW = Number(process.env.ISSUE_SKEW ?? 1.25);

function zipfWeights<T>(items: T[], s: number): [T, number][] {
  const w = items.map((_, i) => 1 / Math.pow(i + 1, s));
  const sum = w.reduce((a, b) => a + b, 0);
  return items.map((item, i) => [item, w[i] / (sum || 1)] as [T, number]);
}
function normalize(pairs: [string, number][]) {
  const sum = pairs.reduce((a, [, w]) => a + w, 0);
  return pairs.map(([k, v]) => [k, v / (sum || 1)]) as [string, number][];
}
function weightedPick<T>(pairs: [T, number][]): T {
  let r = rnd();
  for (const [val, w] of pairs) if ((r -= w) <= 0) return val;
  return pairs[pairs.length - 1][0];
}

function dayMultiplier(d: Date) {
  const wd = d.getUTCDay(); // 0 Sun
  return wd === 0 || wd === 6 ? 0.72 : 1.0;
}
function inWindow(d: Date, win: string) {
  const [a, b] = win.split("..");
  const iso = d.toISOString().slice(0, 10);
  return iso >= a && iso <= b;
}

/* -------------------- Model-aware ENV PRESETS (matches form) -------------------- */
type MKey = "gpt" | "gemini" | "claude" | "grok" | "other";
function modelKey(model: string): MKey {
  const m = model.toLowerCase();
  if (m.includes("gpt") || m.includes("openai")) return "gpt";
  if (m.includes("gemini")) return "gemini";
  if (m.includes("claude")) return "claude";
  if (m.includes("grok")) return "grok";
  return "other";
}

const ENV_PRESETS: Record<MKey, string[]> = {
  gpt: [
    "ChatGPT Web (chat.openai.com)",
    "ChatGPT Desktop",
    "OpenAI Playground",
    "Responses API",
    "Assistants API",
    "Realtime API",
  ],
  gemini: ["Gemini Web", "AI Studio", "Vertex AI", "Workspace add-on"],
  claude: ["Claude Web (claude.ai)", "Anthropic Console", "Messages API"],
  grok: ["Grok Web", "xAI API"],
  other: ["Web app", "API", "Desktop app", "Mobile app"],
};

/** Per-model environment weight profiles (normalized later). */
const ENV_WEIGHTS_PER_MODEL: Record<MKey, [string, number][]> = {
  gpt: [
    ["ChatGPT Web (chat.openai.com)", 0.38],
    ["ChatGPT Desktop", 0.12],
    ["OpenAI Playground", 0.1],
    ["Responses API", 0.16],
    ["Assistants API", 0.14],
    ["Realtime API", 0.1],
  ],
  gemini: [
    ["Gemini Web", 0.4],
    ["AI Studio", 0.22],
    ["Vertex AI", 0.28],
    ["Workspace add-on", 0.1],
  ],
  claude: [
    ["Claude Web (claude.ai)", 0.55],
    ["Anthropic Console", 0.2],
    ["Messages API", 0.25],
  ],
  grok: [
    ["Grok Web", 0.66],
    ["xAI API", 0.34],
  ],
  other: [
    ["Web app", 0.4],
    ["API", 0.3],
    ["Desktop app", 0.2],
    ["Mobile app", 0.1],
  ],
};

function envOptionsFor(model: string): [string, number][] {
  const key = modelKey(model);
  const pairs = ENV_WEIGHTS_PER_MODEL[key] ?? ENV_WEIGHTS_PER_MODEL.other;
  return normalize(pairs);
}

/* -------------------- Issue categories & model biases -------------------- */
const CATS = [
  "Context Memory",
  "Hallucinations",
  "Slowness",
  "Refusals",
  "Tone",
  "Formatting",
  "Tool Use",
  "RAG",
  "Localization",
  "Safety",
] as const;
type Category = (typeof CATS)[number];

const ISSUE_BASE: [string, number][] = zipfWeights([...CATS], ISSUE_SKEW);

function issueWeightsFor(model: string): [string, number][] {
  const mult: Record<Category, number> = Object.fromEntries(
    CATS.map((c) => [c, 1])
  ) as Record<Category, number>;

  const m = modelKey(model);
  // Make models feel distinct in the charts:
  if (m === "gpt") {
    mult["Context Memory"] *= 1.6;
    mult["Slowness"] *= 1.25;
    mult["Tool Use"] *= 1.2;
  } else if (m === "gemini") {
    mult["Hallucinations"] *= 1.65;
    mult["RAG"] *= 1.2;
  } else if (m === "claude") {
    mult["Refusals"] *= 1.6;
    mult["Tone"] *= 1.25;
    mult["Formatting"] *= 1.15;
  } else if (m === "grok") {
    mult["Safety"] *= 1.45;
    mult["Tone"] *= 1.25;
  }

  const pairs = ISSUE_BASE.map(
    ([c, w]) => [c, w * (mult[c as Category] ?? 1)] as [string, number]
  );
  return normalize(pairs);
}

/* -------------------- Tag hints (small, form-aligned) -------------------- */
const MODEL_TAGS: Record<MKey, Partial<Record<Category, string[]>>> = {
  gpt: {
    "Context Memory": ["lost-thread", "file-context-drop", "tools-ignored"],
    Hallucinations: ["made-up-facts", "bad-citation"],
    Slowness: ["slow-first-token", "high-latency"],
    Refusals: ["policy-overreach", "blocked-previously-allowed"],
    "Tool Use": ["schema-drift", "bad-tool-call"],
  },
  gemini: {
    Hallucinations: ["grounding-stale", "source-mismatch"],
    Safety: ["over-blocking", "pii-redaction"],
    Slowness: ["rate-limit", "timeout"],
    RAG: ["missed-fact", "retrieval-failure"],
  },
  claude: {
    Refusals: ["constitutional-refusal", "policy-overreach"],
    "Context Memory": ["lost-thread", "short-memory"],
    Formatting: ["json-invalid", "markdown-broken"],
  },
  grok: {
    Tone: ["persona-drift", "edgy-response"],
    Safety: ["policy-variance", "under-blocking"],
    Hallucinations: ["made-up-facts"],
  },
  other: {
    Slowness: ["timeout", "slow-first-token"],
    RAG: ["stale-index", "retrieval-failure"],
    Formatting: ["markdown-broken", "code-blocks-missing"],
  },
};

function pickTags(model: string, cat: Category): string[] {
  const k = modelKey(model);
  const pool = MODEL_TAGS[k]?.[cat] ?? MODEL_TAGS.other[cat] ?? [];
  const tags = new Set<string>([cat]); // always include the category
  if (pool.length && rnd() < 0.6) tags.add(rand(pool));
  if (pool.length && rnd() < 0.25) tags.add(rand(pool));
  return Array.from(tags);
}

/* -------------------- Model-weight & vibe profiles -------------------- */
const MODEL_WEIGHTS: [string, number][] = zipfWeights(MODELS, MODEL_SKEW);

/** Different vibe priors per model to make the *index* visibly distinct. */
function vibeFor(
  model: string,
  isSignals: boolean
): "worse" | "better" | "normal" {
  const k = modelKey(model);
  const r = rnd();
  // Signals (search/telemetry) skew worse; Feedback skew a bit worse too.
  if (isSignals) {
    if (k === "gpt") return r < 0.84 ? "worse" : r < 0.93 ? "normal" : "better";
    if (k === "gemini")
      return r < 0.78 ? "worse" : r < 0.92 ? "normal" : "better";
    if (k === "claude")
      return r < 0.8 ? "worse" : r < 0.93 ? "normal" : "better";
    if (k === "grok") return r < 0.76 ? "worse" : r < 0.9 ? "normal" : "better";
    return r < 0.8 ? "worse" : r < 0.92 ? "normal" : "better";
  } else {
    if (k === "gpt") return r < 0.87 ? "worse" : r < 0.94 ? "better" : "normal";
    if (k === "gemini")
      return r < 0.82 ? "worse" : r < 0.93 ? "better" : "normal";
    if (k === "claude")
      return r < 0.84 ? "worse" : r < 0.93 ? "better" : "normal";
    if (k === "grok") return r < 0.8 ? "worse" : r < 0.92 ? "better" : "normal";
    return r < 0.84 ? "worse" : r < 0.93 ? "better" : "normal";
  }
}

/* -------------------- Story spikes (per model) -------------------- */
const SP_GPT_CTX = (
  process.env.SPIKE_GPT_CONTEXT ?? "2025-08-20..2025-08-22,3.0"
).split(",");
const SP_GPT_SLOW = (
  process.env.SPIKE_GPT_SLOW ?? "2025-08-27..2025-08-27,2.3"
).split(",");
const SP_GEM_HALL = (
  process.env.SPIKE_GEMINI_HALL ?? "2025-08-24..2025-08-25,2.8"
).split(",");
const SP_CLAU_REF = (
  process.env.SPIKE_CLAUDE_REFUSAL ?? "2025-08-18..2025-08-19,2.6"
).split(",");

function spikeFactor(d: Date, model: string, env: string, cat: string) {
  if (!WITH_SPIKES) return 1;
  const m = modelKey(model);
  const iso = d.toISOString().slice(0, 10);
  if (m === "gpt") {
    if (cat === "Context Memory" && inWindow(d, SP_GPT_CTX[0]))
      return Number(SP_GPT_CTX[1] ?? 3.0);
    if (
      cat === "Slowness" &&
      inWindow(d, SP_GPT_SLOW[0]) &&
      /ChatGPT Web/.test(env)
    )
      return Number(SP_GPT_SLOW[1] ?? 2.3);
  } else if (m === "gemini") {
    if (cat === "Hallucinations" && inWindow(d, SP_GEM_HALL[0]))
      return Number(SP_GEM_HALL[1] ?? 2.8);
  } else if (m === "claude") {
    if (cat === "Refusals" && inWindow(d, SP_CLAU_REF[0]))
      return Number(SP_CLAU_REF[1] ?? 2.6);
  }
  return 1;
}

/* -------------------- Countries & UAs -------------------- */
const COUNTRIES = ["US", "DE", "GB", "IN", "CA", "FR", "AU", "BR", "JP", "NL"];
const UAS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X) Gecko/20100101 Firefox/126.0",
];

/* -------------------- Behavior helpers -------------------- */
function guessMode(env: string, cat: string): Common["mode"] {
  if (/Cursor|Replit|VS Code|JetBrains|Zed|Windsurf/i.test(env)) return "code";
  if (cat === "Tool Use" || cat === "RAG") return "multimodal";
  return "text";
}
function randomEnvVersion(env: string) {
  // “web-2025.8.12” / “desktop-2025.8.2” / “api-2025.8.3”
  const ch = /web/i.test(env)
    ? "web"
    : /api|playground|console|studio|vertex|messages/i.test(env)
    ? "api"
    : /desktop/i.test(env)
    ? "desktop"
    : "app";
  return `${ch}-2025.${randInt(7, 8)}.${randInt(1, 28)}`;
}
function latencyFor(cat: string, env: string) {
  let base = 800;
  if (/ChatGPT Web|Gemini Web|Claude Web|Grok Web/i.test(env)) base = 720;
  if (/API|Playground|Console|Studio|Vertex/i.test(env)) base = 820;
  if (cat === "Slowness") base *= 1.8;
  return Math.max(40, Math.round(base * (0.6 + rnd() * 1.2)));
}
function statusAndError(cat: string): {
  http_status: number;
  error_code: string;
} {
  if (cat === "Tool Use" && rnd() < 0.045)
    return { http_status: 502, error_code: "TOOL_TIMEOUT" };
  if (cat === "RAG" && rnd() < 0.035)
    return { http_status: 504, error_code: "VECTOR_BACKEND_TIMEOUT" };
  if (rnd() < 0.015) return { http_status: 500, error_code: "INTERNAL" };
  return { http_status: 200, error_code: "" };
}
function pickSeverity(cat: Category): Common["severity"] {
  const r = rnd();
  if (cat === "Slowness" || cat === "Context Memory") {
    if (r < 0.05) return "blocking";
    if (r < 0.27) return "major";
    if (r < 0.78) return "noticeable";
    return "minor";
  }
  if (cat === "Refusals" || cat === "Safety") {
    if (r < 0.04) return "blocking";
    if (r < 0.3) return "major";
    if (r < 0.82) return "noticeable";
    return "minor";
  }
  if (r < 0.02) return "blocking";
  if (r < 0.22) return "major";
  if (r < 0.78) return "noticeable";
  return "minor";
}
function pickRepro(cat: Category): Common["repro"] {
  const r = rnd();
  if (cat === "Context Memory")
    return r < 0.5
      ? "often"
      : r < 0.85
      ? "sometimes"
      : r < 0.97
      ? "always"
      : "once";
  if (cat === "Slowness")
    return r < 0.4
      ? "often"
      : r < 0.8
      ? "sometimes"
      : r < 0.95
      ? "always"
      : "once";
  return r < 0.22
    ? "often"
    : r < 0.77
    ? "sometimes"
    : r < 0.95
    ? "once"
    : "always";
}
function jitter(n: number, pct: number) {
  const d = Math.round(n * pct);
  return n + randInt(-d, d);
}

/* -------------------- SQL & Events helpers -------------------- */
async function sql(q: string) {
  const res = await fetch(`${TB_API_BASE}/v0/sql?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${TB_EVENTS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`SQL ${res.status}: ${await res.text()}`);
  return res.json();
}
async function postEvents(ds: string, lines: string[]) {
  const url = `${TB_API_BASE}/v0/events?name=${encodeURIComponent(
    ds
  )}&wait=true`;
  const body = lines.join("\n") + "\n";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TB_EVENTS_TOKEN}`,
        "Content-Type": "application/x-ndjson",
      },
      body,
    });
    if (res.ok) return res.json().catch(() => ({}));
    const text = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_RETRIES)
      throw new Error(`Events ${res.status}: ${text}`);
    const backoff =
      Math.min(2000, 200 * Math.pow(2, attempt)) + Math.floor(rnd() * 250);
    await new Promise((r) => setTimeout(r, backoff));
  }
  return { successful_rows: 0, quarantined_rows: 0 };
}

/* -------------------- Details synthesizer -------------------- */
function synthDetails(cat: Category, model: string, env: string) {
  switch (cat) {
    case "Context Memory":
      return `${model} in ${env} seems to forget earlier turns or file context.`;
    case "Hallucinations":
      return `${model} produced fabricated facts/citations in ${env}.`;
    case "Slowness":
      return `${env} feels slower than usual with ${model}.`;
    case "Refusals":
      return `${model} is refusing prompts it used to accept in ${env}.`;
    case "Tone":
      return `${model} tone/voice feels off or inconsistent in ${env}.`;
    case "Formatting":
      return `${model} returns broken or inconsistent formatting/markdown in ${env}.`;
    case "Tool Use":
      return `${model} calls tools poorly or ignores tool results in ${env}.`;
    case "RAG":
      return `${model} retrieval seems stale or misses obvious facts in ${env}.`;
    case "Localization":
      return `${model} outputs incorrect locale or mixed languages in ${env}.`;
    case "Safety":
      return `${model} safety guardrails behave oddly (over/under-blocking) in ${env}.`;
    default:
      return `Observed ${cat} with ${model} on ${env}.`;
  }
}

/* -------------------- Row builders -------------------- */
function buildSignals(ts: Date): RowSignals {
  const model = weightedPick(MODEL_WEIGHTS);
  const envPairs = envOptionsFor(model);
  const environment = weightedPick(envPairs);
  const issue_category = weightedPick(issueWeightsFor(model)) as Category;
  const severity = pickSeverity(issue_category);
  const repro = pickRepro(issue_category);
  const vibe = vibeFor(model, true);
  const tags = pickTags(model, issue_category);
  const details = synthDetails(issue_category, model, environment);
  const latency_ms = latencyFor(issue_category, environment);
  const { http_status, error_code } = statusAndError(issue_category);

  return {
    timestamp: ts.toISOString(),
    model,
    environment,
    environment_version: randomEnvVersion(environment),
    mode: guessMode(environment, issue_category),
    issue_category,
    issue_tags: tags,
    severity,
    repro,
    vibe,
    details,
    user_agent: rand(UAS),
    ip_address: `198.51.${randInt(0, 254)}.${randInt(1, 254)}`, // TEST-NET-2
    location: rand(COUNTRIES),
    source: "seed",
    latency_ms,
    http_status,
    error_code,
  };
}

function buildFeedback(ts: Date): RowFeedback {
  const model = weightedPick(MODEL_WEIGHTS);
  const envPairs = envOptionsFor(model);
  const environment = weightedPick(envPairs);
  const issue_category = weightedPick(issueWeightsFor(model)) as Category;
  const severity = pickSeverity(issue_category);
  const repro = pickRepro(issue_category);
  const vibe = vibeFor(model, false);
  const tags = pickTags(model, issue_category);
  const details = synthDetails(issue_category, model, environment);
  const latency_ms = latencyFor(issue_category, environment);
  const { http_status, error_code } = statusAndError(issue_category);

  return {
    timestamp: ts.toISOString(),
    model,
    environment,
    environment_version: randomEnvVersion(environment),
    mode: guessMode(environment, issue_category),
    issue_category,
    issue_tags: tags,
    severity,
    repro,
    vibe,
    details,
    user_agent: rand(UAS),
    ip_address: `203.0.${randInt(0, 254)}.${randInt(1, 254)}`, // TEST-NET-3
    location: rand(COUNTRIES),
    source: "web",
    latency_ms,
    http_status,
    error_code,
  };
}

/* -------------------- Main -------------------- */
async function main() {
  console.log(`Preflight → ${TB_API_BASE}`);
  if (!NO_SQL_PREFLIGHT) {
    try {
      await sql("SELECT 1");
    } catch (e) {
      console.warn(
        "SQL preflight failed (token may be events-only). Set NO_SQL_PREFLIGHT=1 to skip. Continuing…"
      );
    }
  }

  if (PURGE) {
    console.log("PURGE=1 → wiping tables before seeding…");
    try {
      await sql(`TRUNCATE TABLE ${DS_SIGNALS}`);
      await sql(`TRUNCATE TABLE ${DS_FEEDBACK}`);
      console.log("Purged.");
    } catch (e) {
      console.warn("Purge failed (needs admin token). Continuing…");
    }
  }

  console.log(
    `Seeding DAYS=${DAYS}, RPD_SIGNALS≈${RPD_SIGNALS}, RPD_FEEDBACK≈${RPD_FEEDBACK}, ` +
      `MIN_TOTAL=${MIN_TOTAL}, SPIKES=${WITH_SPIKES ? "on" : "off"}, DRY_RUN=${
        DRY_RUN ? "on" : "off"
      }, SEED=${SEED}, CUTOFF_UTC=${CUTOFF_HOUR_UTC}:00`
  );

  const today = new Date();
  // Pin noon UTC to avoid local DST quirks
  today.setUTCHours(12, 0, 0, 0);

  const batchSignals: string[] = [];
  const batchFeedback: string[] = [];
  let genSignals = 0,
    genFeedback = 0,
    postedS = 0,
    postedF = 0,
    quarantinedS = 0,
    quarantinedF = 0;

  for (let i = DAYS - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - i);

    const nS = jitter(
      Math.max(8, Math.round(RPD_SIGNALS * dayMultiplier(day))),
      0.25
    );
    const nF = jitter(
      Math.max(3, Math.round(RPD_FEEDBACK * dayMultiplier(day))),
      0.35
    );

    // implicit signals
    for (let k = 0; k < nS; k++) {
      const ts = new Date(day);
      const isLatest = i === 0;
      const maxH = isLatest ? Math.max(0, CUTOFF_HOUR_UTC - 1) : 23;
      ts.setUTCHours(
        randInt(0, maxH),
        randInt(0, 59),
        randInt(0, 59),
        randInt(0, 999)
      );

      // Build & optional spike duplication
      const r = buildSignals(ts);
      const sf = spikeFactor(day, r.model, r.environment, r.issue_category);
      const copies = Math.max(1, Math.round(sf));
      for (let c = 0; c < copies; c++) {
        batchSignals.push(JSON.stringify(r));
        genSignals++;
        if (!DRY_RUN && batchSignals.length >= BATCH_SIZE) {
          const { successful_rows = 0, quarantined_rows = 0 } =
            await postEvents(DS_SIGNALS, batchSignals);
          postedS += successful_rows;
          quarantinedS += quarantined_rows;
          console.log(
            `[signals] POST ${batchSignals.length} -> ok:${successful_rows} q:${quarantined_rows} (total ok:${postedS} q:${quarantinedS})`
          );
          batchSignals.length = 0;
        }
      }
    }

    // explicit feedback
    for (let k = 0; k < nF; k++) {
      const ts = new Date(day);
      const isLatest = i === 0;
      const minH = 8;
      const maxH = isLatest ? Math.max(minH, CUTOFF_HOUR_UTC - 1) : 22;
      ts.setUTCHours(
        randInt(minH, maxH),
        randInt(0, 59),
        randInt(0, 59),
        randInt(0, 999)
      );

      const r = buildFeedback(ts);
      batchFeedback.push(JSON.stringify(r));
      genFeedback++;
      if (!DRY_RUN && batchFeedback.length >= BATCH_SIZE) {
        const { successful_rows = 0, quarantined_rows = 0 } = await postEvents(
          DS_FEEDBACK,
          batchFeedback
        );
        postedF += successful_rows;
        quarantinedF += quarantined_rows;
        console.log(
          `[feedback] POST ${batchFeedback.length} -> ok:${successful_rows} q:${quarantined_rows} (total ok:${postedF} q:${quarantinedF})`
        );
        batchFeedback.length = 0;
      }
    }
  }

  // Ensure hard minimum
  const currentTotal = genSignals + genFeedback;
  if (currentTotal < MIN_TOTAL) {
    const need = MIN_TOTAL - currentTotal;
    const last = new Date(today);
    last.setUTCDate(today.getUTCDate() - 1);
    console.log(
      `Top-up: adding ${need} signals on ${last
        .toISOString()
        .slice(0, 10)} to reach MIN_TOTAL`
    );
    for (let i = 0; i < need; i++) {
      const ts = new Date(last);
      ts.setUTCHours(
        randInt(9, 21),
        randInt(0, 59),
        randInt(0, 59),
        randInt(0, 999)
      );
      const r = buildSignals(ts);
      batchSignals.push(JSON.stringify(r));
      genSignals++;
      if (!DRY_RUN && batchSignals.length >= BATCH_SIZE) {
        const { successful_rows = 0, quarantined_rows = 0 } = await postEvents(
          DS_SIGNALS,
          batchSignals
        );
        postedS += successful_rows;
        quarantinedS += quarantined_rows;
        console.log(
          `[signals] POST ${batchSignals.length} -> ok:${successful_rows} q:${quarantined_rows} (total ok:${postedS} q:${quarantinedS})`
        );
        batchSignals.length = 0;
      }
    }
  }

  // Flush
  if (batchSignals.length) {
    if (DRY_RUN) {
      await fs.writeFile(
        "/tmp/ai_model_signals.ndjson",
        batchSignals.join("\n") + "\n",
        "utf8"
      );
      console.log(
        `[signals] DRY RUN wrote ${batchSignals.length} lines → /tmp/ai_model_signals.ndjson`
      );
    } else {
      const { successful_rows = 0, quarantined_rows = 0 } = await postEvents(
        DS_SIGNALS,
        batchSignals
      );
      postedS += successful_rows;
      quarantinedS += quarantined_rows;
      console.log(
        `[signals] POST ${batchSignals.length} -> ok:${successful_rows} q:${quarantined_rows} (total ok:${postedS} q:${quarantinedS})`
      );
    }
  }
  if (batchFeedback.length) {
    if (DRY_RUN) {
      await fs.writeFile(
        "/tmp/ai_user_feedback.ndjson",
        batchFeedback.join("\n") + "\n",
        "utf8"
      );
      console.log(
        `[feedback] DRY RUN wrote ${batchFeedback.length} lines → /tmp/ai_user_feedback.ndjson`
      );
    } else {
      const { successful_rows = 0, quarantined_rows = 0 } = await postEvents(
        DS_FEEDBACK,
        batchFeedback
      );
      postedF += successful_rows;
      quarantinedF += quarantined_rows;
      console.log(
        `[feedback] POST ${batchFeedback.length} -> ok:${successful_rows} q:${quarantined_rows} (total ok:${postedF} q:${quarantinedF})`
      );
    }
  }

  console.log(
    `Done. genSignals=${genSignals} genFeedback=${genFeedback} total=${
      genSignals + genFeedback
    } postedS=${postedS} postedF=${postedF} quarantinedS=${quarantinedS} quarantinedF=${quarantinedF}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
