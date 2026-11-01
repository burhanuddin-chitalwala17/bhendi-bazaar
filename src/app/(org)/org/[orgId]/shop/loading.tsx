import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/shared/page-shell";

/** Row skeletons while the Shop tab reads (own-store onboarding ux.md, Shop hub Loading). */
export default function ShopHubLoading() {
  return (
    <PageShell width="wide">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-36 w-full rounded-card" />
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-card" />
        ))}
      </div>
    </PageShell>
  );
}
