"use client";
import { useState } from "react";
import { trpc } from "@/app/lib/trpc-client";

const ENVIRONMENTS = [
  "ChatGPT Web",
  "OpenAI API",
  "Cursor IDE",
  "Notion AI",
  "Replit AI",
  "Bard app",
];
const CATEGORIES = [
  "Context Memory",
  "Hallucinations",
  "Slowness",
  "Refusals",
  "Tone",
  "Formatting",
];
const TAGS = [
  "not-remembering",
  "slow-first-token",
  "formatting-markdown",
  "unsafe-refusal",
  "citation-error",
  "code-regression",
];

export default function ReportIssueForm({
  model,
  onSubmitted,
}: {
  model: string;
  onSubmitted?: () => void;
}) {
  const [environment, setEnv] = useState(ENVIRONMENTS[0]);
  const [issue_category, setCat] = useState(CATEGORIES[0]);
  const [issue_tags, setTags] = useState<string[]>([]);
  const [severity, setSeverity] = useState<
    "minor" | "noticeable" | "major" | "blocking"
  >("noticeable");
  const [repro, setRepro] = useState<"once" | "sometimes" | "often" | "always">(
    "sometimes"
  );
  const [vibe, setVibe] = useState<"worse" | "better" | "normal">("worse");
  const [details, setDetails] = useState("");

  const submit = trpc.report.submit.useMutation({
    onSuccess: () => {
      setDetails("");
      setTags([]);
      onSubmitted?.();
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <h3 className="mb-3 text-base font-semibold">Report a vibe change</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate({
            model,
            environment,
            issue_category,
            issue_tags,
            severity,
            repro,
            vibe,
            details,
          });
        }}
        className="space-y-3 text-sm"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-foreground/70">Environment</div>
            <select
              className="w-full rounded-md border border-border bg-background p-2"
              value={environment}
              onChange={(e) => setEnv(e.target.value)}
            >
              {ENVIRONMENTS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-foreground/70">Issue</div>
            <select
              className="w-full rounded-md border border-border bg-background p-2"
              value={issue_category}
              onChange={(e) => setCat(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <div className="mb-1 text-foreground/70">Tags</div>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <label
                key={t}
                className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={issue_tags.includes(t)}
                  onChange={(e) =>
                    setTags((prev) =>
                      e.target.checked
                        ? [...prev, t]
                        : prev.filter((x) => x !== t)
                    )
                  }
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <div className="mb-1 text-foreground/70">Severity</div>
            <select
              className="w-full rounded-md border border-border bg-background p-2"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
            >
              <option value="minor">minor</option>
              <option value="noticeable">noticeable</option>
              <option value="major">major</option>
              <option>blocking</option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-foreground/70">Repro</div>
            <select
              className="w-full rounded-md border border-border bg-background p-2"
              value={repro}
              onChange={(e) => setRepro(e.target.value as typeof repro)}
            >
              <option value="once">once</option>
              <option value="sometimes">sometimes</option>
              <option value="often">often</option>
              <option>always</option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-foreground/70">Vibe</div>
            <select
              className="w-full rounded-md border border-border bg-background p-2"
              value={vibe}
              onChange={(e) => setVibe(e.target.value as typeof vibe)}
            >
              <option value="worse">worse</option>
              <option value="better">better</option>
              <option value="normal">normal</option>
            </select>
          </label>
        </div>

        <label className="block">
          <div className="mb-1 text-foreground/70">Details (optional)</div>
          <textarea
            className="w-full rounded-md border border-border bg-background p-2"
            rows={4}
            placeholder="What changed? Include a short example if helpful."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            disabled={submit.isPending}
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
