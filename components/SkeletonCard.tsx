export default function SkeletonCard() {
  return (
    <div className="h-40 animate-pulse rounded-2xl border border-border bg-background overflow-hidden">
      <div
        className="
            h-full w-full rounded-2xl 
            bg-[linear-gradient(100deg,
              transparent_40%,
              color-mix(in_srgb,var(--foreground)_25%,transparent)_50%,
              transparent_60%
            )]
            bg-[length:200%_100%]
            animate-[shimmer_1.5s_infinite]
          "
      />
    </div>
  );
}
