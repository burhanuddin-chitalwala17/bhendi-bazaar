"use client";

import { ErrorState } from "@/components/shared/states/ErrorState";
import { SHOP_ORDERS_COPY } from "@/components/org/parcels/parcel-copy";
import { ORG_ERROR_COPY } from "@/components/org/pages-copy";

/** The shop's orders could not load (ux.md "Shop orders", Retryable error). `retry` re-renders the segment (Next 16). */
export default function ShopOrdersError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorState as="h1" title={ORG_ERROR_COPY.orders} description={SHOP_ORDERS_COPY.loadFailed} onRetry={() => retry()} retryLabel={SHOP_ORDERS_COPY.tryAgain} />;
}
