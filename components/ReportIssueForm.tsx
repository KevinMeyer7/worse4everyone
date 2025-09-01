"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/app/lib/trpc-client";

const ENV_PRESETS = {
  gpt: [
    "ChatGPT Web",
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

const CATEGORIES = [
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
type Category = (typeof CATEGORIES)[number];

type Severity = "minor" | "noticeable" | "major" | "blocking";
type Repro = "once" | "sometimes" | "often" | "always";
type Vibe = "worse" | "better" | "normal";

/** Quick, model-specific tag hints (kept small). */
const MODEL_TAGS: Record<
  "gpt" | "gemini" | "claude" | "grok" | "other",
  Partial<Record<Category, string[]>>
> = {
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

function modelKey(model: string): keyof typeof ENV_PRESETS | "other" {
  const m = model.toLowerCase();
  if (m.includes("gpt") || m.includes("openai")) return "gpt";
  if (m.includes("gemini")) return "gemini";
  if (m.includes("claude")) return "claude";
  if (m.includes("grok")) return "grok";
  return "other";
}

function envPresetsFor(model: string): string[] {
  const key = modelKey(model);
  const presets = ENV_PRESETS[key] ?? [];
  return presets.length
    ? presets
    : ["Web app", "API", "Desktop app", "Mobile app"];
}

// Light guess for mode — purely for convenience in payload
function guessMode(
  env: string,
  cat: string
): "text" | "code" | "image" | "audio" | "multimodal" {
  if (/cursor|vscode|replit|jetbrains|zed/i.test(env)) return "code";
  if (/tool|rag/i.test(cat)) return "multimodal";
  return "text";
}

export default function ReportIssueForm({
  model,
  onSubmitted,
}: {
  model: string;
  onSubmitted?: () => void;
}) {
  const envOptions = useMemo(() => envPresetsFor(model), [model]);
  const [environment, setEnvironment] = useState(envOptions[0] ?? "");
  const [useOther, setUseOther] = useState(false);
  const [otherEnv, setOtherEnv] = useState("");

  const [issue_category, setIssueCategory] =
    useState<Category>("Hallucinations");
  const [issue_tags, setIssueTags] = useState<string[]>([]);
  const [severity, setSeverity] = useState<Severity>("noticeable");
  const [repro, setRepro] = useState<Repro>("sometimes");
  const [vibe, setVibe] = useState<Vibe>("worse");
  const [details, setDetails] = useState("");

  // Reset env presets when model changes
  useEffect(() => {
    const opts = envPresetsFor(model);
    setEnvironment(opts[0] ?? "");
    setUseOther(false);
    setOtherEnv("");
    setIssueTags([]); // clear tags on model change
  }, [model]);

  // small set of tag suggestions based on model + category
  const tagHints = (
    MODEL_TAGS[modelKey(model)]?.[issue_category] ??
    MODEL_TAGS.other[issue_category] ??
    []
  ).slice(0, 5);

  const submit = trpc.report.submit.useMutation({
    onSuccess: () => {
      setDetails("");
      setIssueTags([]);
      onSubmitted?.();
    },
  });

  const envValue = useOther ? otherEnv.trim() : environment;
  const canSubmit = Boolean(envValue && issue_category);

  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <h3 className="mb-3 text-base font-semibold">Report a vibe change</h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          submit.mutate({
            model,
            environment: envValue,
            issue_category,
            issue_tags,
            severity,
            repro,
            vibe,
            mode: guessMode(envValue, issue_category),
            details,
          });
        }}
        className="space-y-4 text-sm"
      >
        {/* Top row: Environment | Issue */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
          <label className="block">
            <div className="mb-1 text-foreground/70">Environment</div>
            <select
              className="w-full rounded-md border border-border bg-background p-2 disabled:opacity-60"
              value={useOther ? "__other__" : environment}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__other__") {
                  setUseOther(true);
                } else {
                  setUseOther(false);
                  setEnvironment(v);
                }
              }}
            >
              {envOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value="__other__">Other…</option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-foreground/70">Issue</div>
            <select
              className="w-full rounded-md border border-border bg-background p-2"
              value={issue_category}
              onChange={(e) => setIssueCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Quick tags (now full-width row) */}
        <div className="block">
          <div className="mb-1 text-foreground/70">Quick tags (optional)</div>
          <div className="flex flex-wrap gap-2">
            {tagHints.map((t) => (
              <label
                key={t}
                className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1"
              >
                <input
                  type="checkbox"
                  className="accent-current"
                  checked={issue_tags.includes(t)}
                  onChange={(e) =>
                    setIssueTags((prev) =>
                      e.target.checked
                        ? [...prev, t]
                        : prev.filter((x) => x !== t)
                    )
                  }
                />
                <span>{t}</span>
              </label>
            ))}
            <FreeTag onAdd={(t) => setIssueTags((prev) => [...prev, t])} />
          </div>
        </div>

        {/* Severity / Repro / Vibe */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-start">
          <SelectField
            label="Severity"
            value={severity}
            onChange={(v) => setSeverity(v as Severity)}
            options={["minor", "noticeable", "major", "blocking"]}
          />
          <SelectField
            label="Repro"
            value={repro}
            onChange={(v) => setRepro(v as Repro)}
            options={["once", "sometimes", "often", "always"]}
          />
          <SelectField
            label="Vibe"
            value={vibe}
            onChange={(v) => setVibe(v as Vibe)}
            options={["worse", "better", "normal"]}
          />
        </div>

        {/* Details */}
        <label className="block">
          <div className="mb-1 text-foreground/70">Details (optional)</div>
          <textarea
            className="w-full rounded-md border border-border bg-background p-2"
            rows={4}
            placeholder="What changed? Add a short example if helpful."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            disabled={submit.isPending || !canSubmit}
            type="submit"
          >
            {submit.isPending ? "Submitting…" : "Submit"}
          </button>
          {submit.isError && (
            <span className="text-sm text-rose-600">
              Failed: {String(submit.error?.message || "Unknown error")}
            </span>
          )}
          {submit.isSuccess && (
            <span className="text-sm text-emerald-600">
              Thanks! Added to the live data.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

/** tiny helpers */
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-foreground/70">{label}</div>
      <select
        className="w-full rounded-md border border-border bg-background p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function FreeTag({ onAdd }: { onAdd: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="inline-flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const t = v.trim();
        if (t) onAdd(t);
        setV("");
      }}
    >
      <input
        className="w-32 rounded-md border border-border bg-background px-2 py-1"
        placeholder="add tag…"
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <button
        type="submit"
        className="rounded-md border border-border px-2 py-1 hover:bg-muted/60"
        title="Add tag"
      >
        +
      </button>
    </form>
  );
}
