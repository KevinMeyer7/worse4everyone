"use client";

import { cn } from "@/lib/utils";

export function RetroButton({
  className,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 active:translate-y-[1px]",
        "outline-none focus:ring-2 focus:ring-sky-300",
        loading && "opacity-60"
      )}
      {...props}
    />
  );
}
