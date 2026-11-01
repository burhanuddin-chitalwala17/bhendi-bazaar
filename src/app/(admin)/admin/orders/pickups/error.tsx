"use client";

import { Button } from "@/components/ui/button";
import { NOT_PACKED_COPY, QUEUE_COPY } from "@/components/order/pickups/pickups-copy";

/** ux.md "admin pickups" Retryable error: the whole queue failed to load. */
export default function PickupsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-destructive bg-destructive/10 p-4 text-sm">
      <p>{QUEUE_COPY.loadFailed}</p>
      <Button variant="outline" className="min-h-10 self-start" onClick={reset}>
        {NOT_PACKED_COPY.tryAgain}
      </Button>
    </div>
  );
}
