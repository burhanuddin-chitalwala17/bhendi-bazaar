import { SkeletonHeader, SkeletonRows, SkeletonTiles } from "@/components/shared/states/skeletons";

/** A portal page while it reads: its header, then rows (a list) or tiles (a grid of pictures). */
export function PortalPageSkeleton({ shape = "rows", label }: { shape?: "rows" | "tiles"; label: string }) {
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <SkeletonHeader />
      {shape === "tiles" ? <SkeletonTiles count={6} /> : <SkeletonRows count={6} />}
    </div>
  );
}
