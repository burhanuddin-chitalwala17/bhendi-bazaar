import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/shared/page-shell";
import { StillLoading } from "@/components/channel/still-loading";
import { SETTLE } from "@/components/channel/settle-copy";

/** Header at once, field skeletons (product-merge ux.md "Loading the listing"). */
export default function SettleLoading() {
  return (
    <PageShell width="narrow">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-card" />
      ))}
      <StillLoading text={SETTLE.stillLoading} />
    </PageShell>
  );
}
