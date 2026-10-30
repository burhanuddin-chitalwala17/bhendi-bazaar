import { PageShell } from "@/components/shared/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { StillLoading } from "@/components/channel/still-loading";
import { PREVIEW } from "@/components/channel/stock-copy";

/** Every linked listing is read from the marketplace first (inventory-sync ux.md "Turn-on preview: Loading"). */
export default function Loading() {
  return (
    <PageShell width="narrow">
      <div className="flex flex-col gap-3" aria-busy>
        <p className="text-sm">{PREVIEW.reading("the marketplace")}</p>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <StillLoading text={PREVIEW.stillReading("the marketplace")} />
      </div>
    </PageShell>
  );
}
