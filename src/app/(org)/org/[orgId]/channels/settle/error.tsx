"use client";

import { Button } from "@/components/ui/button";
import { SETTLE, SETTLE_ACTION } from "@/components/channel/settle-copy";

/** The Settle page could not load (product-merge ux.md "Couldn't read the listing"). */
export default function SettleError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-destructive bg-destructive/10 p-4 text-sm">
      <p>{SETTLE.loadFailed}</p>
      <Button variant="outline" className="min-h-10 self-start" onClick={reset}>
        {SETTLE_ACTION.tryAgain}
      </Button>
    </div>
  );
}
