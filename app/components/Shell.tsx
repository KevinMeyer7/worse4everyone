"use client";

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-lg font-semibold tracking-tight">
            Worse for everyone? — Issue Breakdown
          </h1>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </main>
  );
}
