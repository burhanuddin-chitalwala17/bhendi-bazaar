import { SkeletonHeader, SkeletonRows, SkeletonTiles } from "@/components/shared/states/skeletons";

/** A page's shape while it loads: its header, then rows or tiles, labelled for screen readers. */
export function PageLoading({
  label,
  shape = "rows",
  count = 4,
}: {
  label: string;
  shape?: "rows" | "tiles";
  count?: number;
}) {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <SkeletonHeader />
      {shape === "rows" ? <SkeletonRows count={count} /> : <SkeletonTiles count={count} />}
    </div>
  );
}
