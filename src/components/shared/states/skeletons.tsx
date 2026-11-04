import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading in the shape of what is coming, so nothing jumps when it lands. No spinners on a page;
 * `ui/skeleton` stays the primitive these are built from.
 */

export function SkeletonHeader({ description = true, className }: { description?: boolean; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-8 w-48" />
      {description && <Skeleton className="h-4 w-72 max-w-full" />}
    </div>
  );
}

/** A list's rows: thumbnail, a title line and a meta line, as `ResourceList` draws them on a phone. */
export function SkeletonRows({ count = 4, thumbnail = true, className }: { count?: number; thumbnail?: boolean; className?: string }) {
  return (
    <div className={cn("divide-y divide-border rounded-card border border-border bg-card", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          {thumbnail && <Skeleton className="h-14 w-11 shrink-0 rounded-field" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Cards in a grid: one column on a phone, more as the screen allows. */
export function SkeletonTiles({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-card" />
      ))}
    </div>
  );
}
