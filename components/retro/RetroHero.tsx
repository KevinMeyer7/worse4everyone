"use client";

import { ReactNode } from "react";

export default function RetroHero({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-background p-6 text-foreground shadow-[0_0_20px_color-mix(in_srgb,var(--foreground)_15%,transparent)]">
        {/* subtle glow using your token color */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(400px_circle_at_20%_-10%,_color-mix(in_srgb,var(--foreground)_22%,transparent),_transparent),radial-gradient(360px_circle_at_80%_-20%,_color-mix(in_srgb,var(--foreground)_16%,transparent),_transparent)]" />
        </div>

        {/* scanlines (works even without global .crt) */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.10] [background-image:repeating-linear-gradient(to_bottom,rgba(255,255,255,.08)_0_1px,transparent_1px_3px)]"
          aria-hidden
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {/* plain text in normal mode, terminal-green inside .hacker via tokens */}
              <span className="text-foreground">{title}</span>
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-foreground/70">{subtitle}</p>
            )}
          </div>

          {children && <div className="mt-2 sm:mt-0">{children}</div>}
        </div>
      </div>
    </section>
  );
}
