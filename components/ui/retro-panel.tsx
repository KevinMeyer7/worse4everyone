import * as React from "react";
import { cn } from "@/lib/utils";

export function RetroPanel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur",
        className
      )}
      {...props}
    />
  );
}
