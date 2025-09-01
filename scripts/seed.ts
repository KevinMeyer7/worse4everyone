/* Seed Tinybird (v2): realistic mock data for
   - ai_model_signals (implicit)
   - ai_user_feedback (explicit)

   Schema recap (both tables have these fields; signals has defaults but we send them anyway):
     timestamp, model, environment, environment_version, mode,
     issue_category, issue_tags[], severity, repro, vibe,
     details, user_agent, ip_address, location, source,
     latency_ms, http_status, error_code

   ---- Run (Local) ----
     export TB_EVENTS_TOKEN='p.<local-token>'         # Events token or Admin
     export TB_API_BASE='http://localhost:7181'
     ts-node scripts/seed_v2.ts

   ---- Run (Cloud, europe-west2) ----
     export TB_EVENTS_TOKEN='p.<cloud-token>'         # copy from `tb --cloud token copy <ID>`
     export TB_API_BASE='https://api.europe-west2.gcp.tinybird.co'
     ts-node scripts/seed_v2.ts

   Useful knobs:
     DAYS=45 RPD_SIGNALS=220 RPD_FEEDBACK=40 MIN_TOTAL=5000
     BATCH=1000 SPIKES=1 SEED=42 DRY_RUN=0
     MODELS="GPT-5,GPT-4o,Gemini 2.5,Claude 3.7,Grok-3"
     ENVS="ChatGPT Web,OpenAI API,Cursor IDE,Notion AI,Replit AI,Bard app"
     CATS="Context Memory,Hallucinations,Slowness,Refusals,Tone,Formatting,Tool Use,RAG,Localization,Safety"
     TAGS="Context Memory,Hallucinations,Latency,Refusals,Formatting,Tool Use,RAG,Localization,Safety,Policy"
     MODEL_SKEW=1.4 ISSUE_SKEW=1.25
     PURGE=0 NO_SQL_PREFLIGHT=0
*/

import fs from "node:fs/promises";

// -------------------- Types --------------------
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

// -------------------- Env config --------------------
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

// Volume & behavior knobs
const DAYS = Number(process.env.DAYS ?? 35);
const RPD_SIGNALS = Number(process.env.RPD_SIGNALS ?? 220); // implicit/day
const RPD_FEEDBACK = Number(process.env.RPD_FEEDBACK ?? 40); // explicit/day
const MIN_TOTAL = Number(process.env.MIN_TOTAL ?? 5000);
const BATCH_SIZE = Number(process.env.BATCH ?? 1000);
const WITH_SPIKES = (process.env.SPIKES ?? "1") === "1";
const DRY_RUN = (process.env.DRY_RUN ?? "0") === "1";
const MAX_RETRIES = Number(process.env.RETRIES ?? 5);
const SEED = Number(process.env.SEED ?? Date.now());

const MODELS = (
  process.env.MODELS ?? "GPT-5,GPT-4o,Gemini 2.5,Claude 3.7,Grok-3"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ENVIRONMENTS = (
  process.env.ENVS ??
  "ChatGPT Web,OpenAI API,Cursor IDE,Notion AI,Replit AI,Bard app"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CATS = (
  process.env.CATS ??
  "Context Memory,Hallucinations,Slowness,Refusals,Tone,Formatting,Tool Use,RAG,Localization,Safety"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TAGS = (
  process.env.TAGS ??
  "Context Memory,Hallucinations,Latency,Refusals,Formatting,Tool Use,RAG,Localization,Safety,Policy"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Countries (ISO-2)
const COUNTRIES = ["US", "DE", "GB", "IN", "CA", "FR", "AU", "BR", "JP", "NL"];

// UAs
const UAS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X) Gecko/20100101 Firefox/126.0",
];

// Skew & weight behavior
const MODEL_SKEW = Number(process.env.MODEL_SKEW ?? 1.4);
const ISSUE_SKEW = Number(process.env.ISSUE_SKEW ?? 1.25);

// -------------------- RNG --------------------
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

// -------------------- helpers --------------------
function zipfWeights<T>(items: T[], s: number): [T, number][] {
  const w = items.map((_, i) => 1 / Math.pow(i + 1, s));
  const sum = w.reduce((a, b) => a + b, 0);
  return items.map((item, i) => [item, w[i] / sum] as [T, number]);
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
  return wd === 0 || wd === 6 ? 0.7 : 1.0;
}

function inWindow(d: Date, win: string) {
  const [a, b] = win.split("..");
  const iso = d.toISOString().slice(0, 10);
  return iso >= a && iso <= b;
}

// spikes (env tunable)
const SP1 = (
  process.env.SPIKE_CURSOR_CONTEXT ?? "2025-08-20..2025-08-22,3.2"
).split(",");
const SP2 = (
  process.env.SPIKE_CHATGPT_SLOW ?? "2025-08-27..2025-08-27,2.5"
).split(",");

function spikeFactor(d: Date, model: string, env: string, cat: string) {
  if (!WITH_SPIKES) return 1;
  if (
    model.includes("GPT-5") &&
    env === "Cursor IDE" &&
    cat === "Context Memory" &&
    inWindow(d, SP1[0])
  ) {
    return Number(SP1[1] ?? 3.2);
  }
  if (env === "ChatGPT Web" && cat === "Slowness" && inWindow(d, SP2[0])) {
    return Number(SP2[1] ?? 2.5);
  }
  return 1;
}

// distributions
const MODEL_WEIGHTS: [string, number][] = process.env.MODEL_WEIGHTS
  ? normalize(
      process.env.MODEL_WEIGHTS.split(",").map((p) => {
        const [name, w] = p.split(":");
        return [name.trim(), Number(w)] as [string, number];
      })
    )
  : zipfWeights(MODELS, MODEL_SKEW);

const ENV_WEIGHTS: [string, number][] = normalize([
  ["ChatGPT Web", 0.42],
  ["Cursor IDE", 0.22],
  ["OpenAI API", 0.17],
  ["Notion AI", 0.08],
  ["Replit AI", 0.07],
  ["Bard app", 0.04],
]);

const ISSUE_BASE: [string, number][] = zipfWeights(CATS, ISSUE_SKEW);

function issueWeightsFor(model: string): [string, number][] {
  const mult: Record<string, number> = {};
  for (const c of CATS) mult[c] = 1;

  const m = model.toLowerCase();
  if (m.includes("gpt-5")) {
    mult["Context Memory"] *= 1.5;
    mult["Slowness"] *= 1.25;
    mult["Tool Use"] *= 1.2;
  } else if (m.includes("gpt-4")) {
    mult["Formatting"] *= 1.25;
    mult["Tone"] *= 1.1;
  } else if (m.includes("claude")) {
    mult["Refusals"] *= 1.6;
    mult["Tone"] *= 1.25;
  } else if (m.includes("gemini")) {
    mult["Hallucinations"] *= 1.6;
    mult["RAG"] *= 1.2;
  } else if (m.includes("grok")) {
    mult["Safety"] *= 1.4;
    mult["Hallucinations"] *= 1.2;
  }

  const pairs = ISSUE_BASE.map(
    ([c, w]) => [c, w * (mult[c] ?? 1)] as [string, number]
  );
  return normalize(pairs);
}

function guessMode(env: string, cat: string): Common["mode"] {
  if (env === "Cursor IDE" || env === "Replit AI") return "code";
  if (cat === "Tool Use" || cat === "RAG") return "multimodal";
  return "text";
}

function synthDetails(cat: string, model: string, env: string) {
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
      return `${model} tone/voice feels off/inconsistent in ${env}.`;
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

function randomEnvVersion(env: string) {
  // “web-2025.8.12” / “desktop-2025.8.2”
  const channels = env.includes("Web")
    ? "web"
    : env.includes("API")
    ? "api"
    : "desktop";
  return `${channels}-2025.${randInt(7, 8)}.${randInt(1, 28)}`;
}

function latencyFor(cat: string, env: string) {
  let base = 800;
  if (env === "ChatGPT Web") base = 700;
  if (env === "Cursor IDE") base = 900;
  if (cat === "Slowness") base *= 1.8;
  return Math.max(40, Math.round(base * (0.6 + rnd() * 1.2)));
}

function statusAndError(cat: string): {
  http_status: number;
  error_code: string;
} {
  // Rare explicit HTTP errors for flavor
  if (cat === "Tool Use" && rnd() < 0.04)
    return { http_status: 502, error_code: "TOOL_TIMEOUT" };
  if (cat === "RAG" && rnd() < 0.03)
    return { http_status: 504, error_code: "VECTOR_BACKEND_TIMEOUT" };
  if (rnd() < 0.015) return { http_status: 500, error_code: "INTERNAL" };
  return { http_status: 200, error_code: "" };
}

function pickSeverity(cat: string): Common["severity"] {
  const r = rnd();
  if (cat === "Slowness" || cat === "Context Memory") {
    if (r < 0.05) return "blocking";
    if (r < 0.25) return "major";
    if (r < 0.75) return "noticeable";
    return "minor";
  }
  if (cat === "Refusals" || cat === "Safety") {
    if (r < 0.04) return "blocking";
    if (r < 0.3) return "major";
    if (r < 0.8) return "noticeable";
    return "minor";
  }
  if (r < 0.02) return "blocking";
  if (r < 0.2) return "major";
  if (r < 0.75) return "noticeable";
  return "minor";
}

function pickRepro(cat: string): Common["repro"] {
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
  return r < 0.2
    ? "often"
    : r < 0.75
    ? "sometimes"
    : r < 0.95
    ? "once"
    : "always";
}

function pickVibe(isSignals: boolean): Common["vibe"] {
  // Implicit searches tend to signal “worse”
  const r = rnd();
  if (isSignals) return r < 0.82 ? "worse" : r < 0.92 ? "normal" : "better";
  // User feedback skews worse but has some better reports
  return r < 0.86 ? "worse" : r < 0.94 ? "better" : "normal";
}

function pickTags(cat: string): string[] {
  const tags = new Set<string>([cat]);
  if (rnd() < 0.35) tags.add(rand(TAGS));
  if (rnd() < 0.12) tags.add(rand(TAGS));
  return Array.from(tags);
}

function jitter(n: number, pct: number) {
  const d = Math.round(n * pct);
  return n + randInt(-d, d);
}

// -------------------- HTTP helpers --------------------
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

// -------------------- Row builders --------------------
function buildSignals(ts: Date): RowSignals {
  const model = weightedPick(MODEL_WEIGHTS);
  const environment = weightedPick(ENV_WEIGHTS);
  const issue_category = weightedPick(issueWeightsFor(model));
  const mode = guessMode(environment, issue_category);
  const severity = pickSeverity(issue_category);
  const repro = pickRepro(issue_category);
  const vibe = pickVibe(true);
  const details = synthDetails(issue_category, model, environment);
  const tags = pickTags(issue_category);
  const latency_ms = latencyFor(issue_category, environment);
  const { http_status, error_code } = statusAndError(issue_category);

  return {
    timestamp: ts.toISOString(),
    model,
    environment,
    environment_version: randomEnvVersion(environment),
    mode,
    issue_category,
    issue_tags: tags,
    severity,
    repro,
    vibe,
    details,
    user_agent: rand(UAS),
    ip_address: `198.51.${randInt(0, 254)}.${randInt(1, 254)}`,
    location: rand(COUNTRIES),
    source: "seed",
    latency_ms,
    http_status,
    error_code,
  };
}

function buildFeedback(ts: Date): RowFeedback {
  const model = weightedPick(MODEL_WEIGHTS);
  const environment = weightedPick(ENV_WEIGHTS);
  const issue_category = weightedPick(issueWeightsFor(model));
  const mode = guessMode(environment, issue_category);
  const severity = pickSeverity(issue_category);
  const repro = pickRepro(issue_category);
  const vibe = pickVibe(false);
  const details = synthDetails(issue_category, model, environment);
  const tags = pickTags(issue_category);
  const latency_ms = latencyFor(issue_category, environment);
  const { http_status, error_code } = statusAndError(issue_category);

  return {
    timestamp: ts.toISOString(),
    model,
    environment,
    environment_version: randomEnvVersion(environment),
    mode,
    issue_category,
    issue_tags: tags,
    severity,
    repro,
    vibe,
    details,
    user_agent: rand(UAS),
    ip_address: `203.0.${randInt(0, 254)}.${randInt(1, 254)}`,
    location: rand(COUNTRIES),
    source: "web",
    latency_ms,
    http_status,
    error_code,
  };
}

// -------------------- Main --------------------
async function main() {
  console.log(`Preflight → ${TB_API_BASE}`);
  if (!NO_SQL_PREFLIGHT) {
    try {
      await sql("SELECT 1");
    } catch (e) {
      console.warn(
        "SQL preflight failed (token may be events-only). Set NO_SQL_PREFLIGHT=1 to skip. Continuing …"
      );
    }
  }

  console.log(
    `Seeding: DAYS=${DAYS}, RPD_SIGNALS≈${RPD_SIGNALS}, RPD_FEEDBACK≈${RPD_FEEDBACK}, MIN_TOTAL=${MIN_TOTAL}, SPIKES=${
      WITH_SPIKES ? "on" : "off"
    }, DRY_RUN=${DRY_RUN ? "on" : "off"}, SEED=${SEED}`
  );

  const today = new Date();
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
      ts.setUTCHours(
        randInt(0, 23),
        randInt(0, 59),
        randInt(0, 59),
        randInt(0, 999)
      );
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
      ts.setUTCHours(
        randInt(8, 22),
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

  // Ensure hard minimum MIN_TOTAL by topping up signals on the latest day
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
