/* Seed Tinybird with realistic mock data for ai_model_signals (MVP schema)
   Schema fields: timestamp, model, environment, issue_category, details, user_agent, ip_address, location

   Run (Local):
     export TB_EVENTS_TOKEN='p.<local-token>'
     export TB_API_BASE='http://localhost:7181'
     export DS_NAME='ai_model_signals'
     ts-node scripts/seed.ts
   or Node 20+ with ts-node ESM loader:
     TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm scripts/seed.ts

   Run (Cloud, europe-west2):
     export TB_EVENTS_TOKEN='p.<cloud-token>'         # from `tb --cloud token copy <ID>`
     export TB_API_REGION='gcp-europe-west2'          # or set TB_API_BASE directly (see below)
     export TB_API_BASE='https://api.europe-west2.gcp.tinybird.co'  # overrides REGION if set
     export DS_NAME='ai_model_signals'
     ts-node scripts/seed.ts

   Useful knobs:
     DAYS=45 RPD=300 BATCH=1000 SPIKES=1 SEED=42 DRY_RUN=1
     MODELS="GPT-5,GPT-4o,Claude 3.7,Gemini 2.0"
     ENVS="ChatGPT Web,OpenAI API,Cursor IDE,Notion AI,Replit AI,Bard app"
     CATS="Context Memory,Hallucinations,Slowness,Refusals,Tone,Formatting"
*/

import fs from "node:fs/promises";

type Row = {
  timestamp?: string;
  model: string;
  environment: string;
  issue_category: string;
  details: string;
  user_agent: string;
  ip_address: string;
  location: string; // ISO-2
};

const REGION_HOST: Record<string, string> = {
  "gcp-europe-west2": "https://api.europe-west2.gcp.tinybird.co",
  "gcp-us-central1": "https://api.us-central1.gcp.tinybird.co",
  "aws-us-east-1": "https://api.us-east-1.aws.tinybird.co",
  "aws-eu-west-1": "https://api.eu-west-1.aws.tinybird.co",
};

const TB_API_BASE = "https://api.europe-west2.gcp.tinybird.co";
/*   process.env.TB_API_BASE ??
  (process.env.TB_API_REGION
    ? REGION_HOST[process.env.TB_API_REGION]
    : undefined) ??
  "http://localhost:7181"; */

const TB_EVENTS_TOKEN =
  process.env.TB_EVENTS_TOKEN ??
  "p.eyJ1IjogImFkZTZmZDhhLTU5ZmYtNDJhMy04ZmY3LTVlYjkzMjJmMjNiYSIsICJpZCI6ICI2OTc1ZWRhNi02ZGM1LTQwYTktOGEwNi01ODVmODU5OWZlYjMiLCAiaG9zdCI6ICJnY3AtZXVyb3BlLXdlc3QyIn0.giTugkHMe_qUfrAX2ZRQkZwEq_NA1m6J9nbBe0bCVuE";
const DATASOURCE_NAME = process.env.DS_NAME ?? "ai_model_signals";

// ----- knobs you can tweak -----
const DAYS = Number(process.env.DAYS ?? 35); // how many days back
const AVG_REPORTS_PER_DAY = Number(process.env.RPD ?? 120); // overall avg reports/day
const BATCH_SIZE = Number(process.env.BATCH ?? 500); // NDJSON lines per POST
const WITH_SPIKES = (process.env.SPIKES ?? "1") === "1"; // add spicy spikes
const DRY_RUN = (process.env.DRY_RUN ?? "0") === "1"; // write file instead of posting
const MAX_RETRIES = Number(process.env.RETRIES ?? 5);
const SEED = Number(process.env.SEED ?? Date.now());
// --------------------------------

// Minimal CSV overrides
const MODELS = (process.env.MODELS ?? "GPT-5,GPT-4o,Claude 3.7,Gemini 2.0")
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
  "Context Memory,Hallucinations,Slowness,Refusals,Tone,Formatting"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Country mix (ISO-2)
const COUNTRIES = ["US", "DE", "GB", "IN", "CA", "FR", "AU", "BR", "JP", "NL"];

// UA snippets
const UAS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X) Gecko/20100101 Firefox/126.0",
];

// ---------- seeded RNG for reproducibility ----------
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
// ---------------------------------------------------

// Weighted picks (keep GPT-5 heavy by default)
function weightedPick<T>(pairs: [T, number][]): T {
  const s = pairs.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * s;
  for (const [val, w] of pairs) {
    if ((r -= w) <= 0) return val;
  }
  return pairs[0][0];
}

// Daily seasonality (weekends quieter)
function dayMultiplier(date: Date) {
  const day = date.getUTCDay(); // 0=Sun
  if (day === 0 || day === 6) return 0.7;
  return 1.0;
}

// Spikes for storytelling (env-overridable windows)
const SP1 = (
  process.env.SPIKE_CURSOR_CONTEXT ?? "2025-08-20..2025-08-22,3.2"
).split(",");
const SP2 = (
  process.env.SPIKE_CHATGPT_SLOW ?? "2025-08-27..2025-08-27,2.5"
).split(",");

function inWindow(d: Date, win: string) {
  const [a, b] = win.split("..");
  const iso = d.toISOString().slice(0, 10);
  return iso >= a && iso <= b;
}

function spikeFactor(d: Date, model: string, env: string, cat: string) {
  if (!WITH_SPIKES) return 1.0;
  if (
    model === "GPT-5" &&
    env === "Cursor IDE" &&
    cat === "Context Memory" &&
    inWindow(d, SP1[0])
  ) {
    return Number(SP1[1] ?? 3.2);
  }
  if (env === "ChatGPT Web" && cat === "Slowness" && inWindow(d, SP2[0])) {
    return Number(SP2[1] ?? 2.5);
  }
  return 1.0;
}

// Generate a single row with a given timestamp
function makeRow(ts: Date): Row {
  const model = weightedPick(
    (process.env.MODEL_WEIGHTS
      ? process.env.MODEL_WEIGHTS.split(",").map((pair) => {
          const [name, w] = pair.split(":");
          return [name.trim(), Number(w)] as [string, number];
        })
      : [
          ["GPT-5", 0.45],
          ["GPT-4o", 0.25],
          ["Claude 3.7", 0.2],
          ["Gemini 2.0", 0.1],
        ]) as [string, number][]
  );

  const environment = weightedPick([
    ["ChatGPT Web", 0.35],
    ["OpenAI API", 0.15],
    ["Cursor IDE", 0.25],
    ["Notion AI", 0.1],
    ["Replit AI", 0.08],
    ["Bard app", 0.07],
  ]);

  const issue_category = weightedPick([
    ["Context Memory", 0.26],
    ["Hallucinations", 0.2],
    ["Slowness", 0.22],
    ["Refusals", 0.12],
    ["Tone", 0.1],
    ["Formatting", 0.1],
  ]);

  const details = synthDetails(issue_category, model, environment);
  const user_agent = rand(UAS);
  const ip_address = `198.51.${randInt(0, 254)}.${randInt(1, 254)}`; // TEST-NET-2 range
  const location = rand(COUNTRIES);

  return {
    timestamp: ts.toISOString(),
    model,
    environment,
    issue_category,
    details,
    user_agent,
    ip_address,
    location,
  };
}

function synthDetails(cat: string, model: string, env: string) {
  switch (cat) {
    case "Context Memory":
      return `${model} in ${env} seems to lose previous messages or file context after a few turns.`;
    case "Hallucinations":
      return `${model} produced fabricated facts and citations in ${env}.`;
    case "Slowness":
      return `${env} responses feel much slower than usual with ${model}.`;
    case "Refusals":
      return `${model} is over-refusing previously safe prompts in ${env}.`;
    case "Tone":
      return `${model} tone/voice feels off or inconsistent in ${env}.`;
    case "Formatting":
      return `${model} returns broken or inconsistent formatting/markdown in ${env}.`;
    default:
      return `Observed issue: ${cat} on ${model} (${env}).`;
  }
}

async function sql(q: string) {
  const url = `${TB_API_BASE}/v0/sql`;
  const res = await fetch(url + "?q=" + encodeURIComponent(q), {
    headers: { Authorization: `Bearer ${TB_EVENTS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`SQL ${res.status}: ${await res.text()}`);
  return res.json();
}

// robust Events POST with retry/backoff
async function postNDJSON(lines: string[]) {
  const url = `${TB_API_BASE}/v0/events?name=${encodeURIComponent(
    DATASOURCE_NAME
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

    if (res.ok) {
      return res.json().catch(() => ({}));
    }

    const text = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt === MAX_RETRIES) {
      throw new Error(`Events API ${res.status}: ${text}`);
    }

    const backoffMs =
      Math.min(2000, 200 * Math.pow(2, attempt)) + Math.floor(rnd() * 250);
    await new Promise((r) => setTimeout(r, backoffMs));
  }
  return { successful_rows: 0, quarantined_rows: 0 };
}

function jitter(n: number, pct: number) {
  const delta = Math.round(n * pct);
  return n + randInt(-delta, delta);
}

async function main() {
  if (!TB_EVENTS_TOKEN) {
    console.error(
      "Missing TB_EVENTS_TOKEN env var. Use a Local or Cloud token."
    );
    process.exit(1);
  }

  console.log(`Preflight check against ${TB_API_BASE} ...`);
  await sql("SELECT 1"); // fails fast if token/host are wrong

  console.log(
    `Seeding ${DAYS} days into '${DATASOURCE_NAME}' at ${TB_API_BASE}`
  );
  console.log(
    `Seed: ${SEED}  |  RPD≈${AVG_REPORTS_PER_DAY}  |  Spike=${
      WITH_SPIKES ? "on" : "off"
    }  |  ${DRY_RUN ? "DRY RUN" : "POSTING"}`
  );

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  const outLines: string[] = [];
  let posted = 0,
    quarantined = 0;

  for (let i = DAYS - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - i);

    const base = Math.max(
      10,
      Math.round(AVG_REPORTS_PER_DAY * dayMultiplier(day))
    );
    const rowsForDay = jitter(base, 0.25); // +/- 25%

    for (let n = 0; n < rowsForDay; n++) {
      // scatter events across the day
      const ts = new Date(day);
      ts.setUTCHours(
        randInt(0, 23),
        randInt(0, 59),
        randInt(0, 59),
        randInt(0, 999)
      );

      const r = makeRow(ts);
      const sf = spikeFactor(day, r.model, r.environment, r.issue_category);
      const copies = Math.max(1, Math.round(sf));
      for (let c = 0; c < copies; c++) {
        outLines.push(JSON.stringify(r));
        if (!DRY_RUN && outLines.length >= BATCH_SIZE) {
          const { successful_rows = 0, quarantined_rows = 0 } =
            await postNDJSON(outLines);
          posted += successful_rows;
          quarantined += quarantined_rows;
          console.log(
            `POSTed ${outLines.length} -> ok:${successful_rows} q:${quarantined_rows} (total ok:${posted} q:${quarantined})`
          );
          outLines.length = 0;
        }
      }
    }
  }

  if (outLines.length) {
    if (DRY_RUN) {
      const path = "/tmp/ai_model_signals_seed.ndjson";
      await fs.writeFile(path, outLines.join("\n") + "\n", "utf8");
      console.log(`DRY RUN: wrote ${outLines.length} lines to ${path}`);
    } else {
      const { successful_rows = 0, quarantined_rows = 0 } = await postNDJSON(
        outLines
      );
      posted += successful_rows;
      quarantined += quarantined_rows;
      console.log(
        `POSTed ${outLines.length} -> ok:${successful_rows} q:${quarantined_rows} (total ok:${posted} q:${quarantined})`
      );
    }
  }

  console.log(`Seed complete. total ok:${posted} q:${quarantined}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
