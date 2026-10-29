import { PageShell } from "@/components/shared/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { StillLoading } from "@/components/channel/still-loading";
import { FAMILY } from "@/components/channel/family-copy";

/** Every member is read from the marketplace first (family-merge ux.md "Loading"). */
export default function Loading() {
  return (
    <PageShell width="narrow">
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <StillLoading text={FAMILY.stillReading("the marketplace")} />
      </div>
    </PageShell>
  );
}
