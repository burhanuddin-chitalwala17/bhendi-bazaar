import { Skeleton } from "@/components/ui/skeleton";
import { StillLoading } from "@/components/channel/still-loading";
import { LISTINGS } from "@/components/channel/listing-copy";

/** Header and tabs at once, then eight rows (ux.md "Loading", "Slow"). */
export default function ChannelListingsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 md:w-32 md:flex-none" />
        <Skeleton className="h-10 flex-1 md:w-32 md:flex-none" />
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-16 rounded-card" />
      ))}
      <StillLoading text={LISTINGS.stillLoading} />
    </div>
  );
}
