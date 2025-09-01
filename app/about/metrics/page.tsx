// app/about/metrics/page.tsx
"use client";

export default function MetricsDocs() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-3xl font-semibold">About the metrics</h1>
      <p className="mb-8 text-foreground/70">
        Everything on this site is normalized to a common scale so you can
        compare vibes across time and models at a glance.
      </p>

      <section className="mb-8 space-y-3 rounded-2xl border border-border bg-background p-5">
        <h2 className="text-xl font-semibold">Weighted report points</h2>
        <p>
          Each report contributes a <em>weighted point</em> based on{" "}
          <strong>severity</strong> and <strong>reproducibility</strong>:
        </p>
        <ul className="list-inside list-disc text-sm text-foreground/80">
          <li>
            Severity weights: minor <code>0.5</code>, noticeable{" "}
            <code>1.0</code>, major <code>1.6</code>, blocking <code>2.5</code>
          </li>
          <li>
            Repro weights: once <code>0.3</code>, sometimes <code>0.6</code>,
            often <code>0.9</code>, always <code>1.0</code>
          </li>
          <li>
            Row weight = <code>severity_weight × repro_weight</code>
          </li>
        </ul>
        <p className="text-sm text-foreground/70">
          We aggregate these daily for <code>worse</code> and{" "}
          <code>better</code> vibes separately.
        </p>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-border bg-background p-5">
        <h2 className="text-xl font-semibold">Worseness Index (0–100)</h2>
        <p>
          To make trends intuitive, we convert daily <code>net</code> =
          worse−better weighted points into a normalized index:
        </p>
        <ol className="list-inside list-decimal space-y-1 text-sm text-foreground/80">
          <li>
            Compute daily <code>net_w</code> for each model
          </li>
          <li>Take a 28-day rolling mean/σ (prior days only)</li>
          <li>
            Compute z-score = <code>(net_w − mean) / σ</code>
          </li>
          <li>
            Map to 0–100: <code>index = clamp(0,100, 50 + 15 × z)</code>
          </li>
        </ol>
        <p className="text-sm text-foreground/70">
          ≈50 is baseline; &gt;50 means worse than usual for that model, &lt;50
          better than usual.
        </p>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-border bg-background p-5">
        <h2 className="text-xl font-semibold">KPIs on model pages</h2>
        <ul className="list-inside list-disc text-sm text-foreground/80">
          <li>
            <strong>Today (Index)</strong>: today’s 0–100 worseness index
          </li>
          <li>
            <strong>7-day baseline (Index)</strong>: average of the previous 7
            days’ index values
          </li>
          <li>
            <strong>Δ vs 7d (pts)</strong>: today index − 7-day baseline index
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-background p-5">
        <h2 className="mb-1 text-xl font-semibold">Breakdowns</h2>
        <p className="mb-2 text-sm text-foreground/80">
          Issue and environment charts show weighted worse points and a % share
          of the total in range.
        </p>
        <ul className="list-inside list-disc text-sm text-foreground/80">
          <li>
            <strong>reports_w</strong>: weighted worse points (sum of row
            weights)
          </li>
          <li>
            <strong>pct_w</strong>:{" "}
            <code>100 × reports_w / sum(reports_w)</code> over the slice
          </li>
        </ul>
      </section>
    </main>
  );
}
