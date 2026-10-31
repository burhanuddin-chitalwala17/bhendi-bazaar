import { Skeleton } from "@/components/ui/skeleton";

/** A page's shape while it loads: a heading and a few blocks, labelled for screen readers. */
export function PageLoading({ label, blocks = 3 }: { label: string; blocks?: number }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: blocks }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-card" />
      ))}
    </div>
  );
}
