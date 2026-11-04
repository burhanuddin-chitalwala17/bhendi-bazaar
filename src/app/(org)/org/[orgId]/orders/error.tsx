"use client";

import { Button } from "@/components/ui/button";
import { SHOP_ORDERS_COPY } from "@/components/org/parcels/parcel-copy";

/** The shop's orders could not load (ux.md "Shop orders", Retryable error). */
export default function ShopOrdersError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-destructive bg-destructive/10 p-4 text-sm">
      <p>{SHOP_ORDERS_COPY.loadFailed}</p>
      <Button variant="outline" className="min-h-10 self-start" onClick={() => retry()}>
        {SHOP_ORDERS_COPY.tryAgain}
      </Button>
    </div>
  );
}
