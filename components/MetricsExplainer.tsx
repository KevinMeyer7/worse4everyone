"use client";
import { useState } from "react";

export default function MetricsExplainer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-medium">About these metrics</div>
        <button
          className="rounded-md border border-border px-2 py-1 text-xs"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 text-foreground/80">
          <p>
            Each report contributes a <em>weighted point</em> based on{" "}
            <strong>severity</strong> and <strong>reproducibility</strong>.
            Severity: minor 0.5, noticeable 1.0, major 1.6, blocking 2.5. Repro:
            once 0.3, sometimes 0.6, often 0.9, always 1.0.
          </p>
          <p>
            We aggregate daily <code>worse</code> and <code>better</code>{" "}
            weighted points, and compute <code>net</code> = worse − better.
          </p>
          <p>
            The <strong>Worseness Index (0–100)</strong> normalizes each model’s
            daily net via a 28-day rolling z-score, mapped to 0–100. ≈50
            baseline; higher means worse than usual for that model.
          </p>
        </div>
      )}
    </div>
  );
}
