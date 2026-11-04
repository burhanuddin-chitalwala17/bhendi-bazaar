import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRows } from "@/components/shared/states/skeletons";

/** The products list while it reads: its tabs, its search, then rows. */
export function ProductsTableSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading products">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-10 w-full" />
      <SkeletonRows count={8} />
    </div>
  );
}
