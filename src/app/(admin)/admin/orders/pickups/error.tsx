"use client";

import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { CONFLICTS_TAB, CONFLICT_COPY, NOT_PACKED_COPY, QUEUE_COPY } from "@/components/order/pickups/pickups-copy";

/** ux.md "admin pickups" and "admin conflicts" Retryable error: the tab failed to load. */
export default function PickupsError({ retry }: { error: unknown; retry: () => void }) {
  const conflicts = useSearchParams().get("tab") === CONFLICTS_TAB;
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-destructive bg-destructive/10 p-4 text-sm">
      <p>{conflicts ? CONFLICT_COPY.loadFailed : QUEUE_COPY.loadFailed}</p>
      <Button variant="outline" className="min-h-10 self-start" onClick={() => retry()}>
        {NOT_PACKED_COPY.tryAgain}
      </Button>
    </div>
  );
}
