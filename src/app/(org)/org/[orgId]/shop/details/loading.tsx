import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/shared/page-shell";

/** ux Loading: section skeletons. */
export default function Loading() {
  return (
    <PageShell width="wide">
      <Skeleton className="h-9 w-48" />
      <div className="space-y-4 lg:w-3/5">
        <Skeleton className="h-64 w-full" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </PageShell>
  );
}
