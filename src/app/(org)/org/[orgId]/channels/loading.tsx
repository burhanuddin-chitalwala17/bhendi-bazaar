import { Skeleton } from "@/components/ui/skeleton";
import { StillLoading } from "@/components/channel/still-loading";

/** Five cards in their final places while the channels load (ux.md "Loading"). */
export default function ChannelsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-card" />
        ))}
      </div>
      <StillLoading text="Still loading…" />
    </div>
  );
}
