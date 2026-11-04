"use client";

import { ErrorState } from "@/components/shared/states/ErrorState";
import { SETTLE, SETTLE_ACTION } from "@/components/channel/settle-copy";
import { ORG_ERROR_COPY } from "@/components/org/pages-copy";

/** The Settle page could not load (product-merge ux.md "Couldn't read the listing"). `retry` re-renders the segment (Next 16). */
export default function SettleError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorState as="h1" title={ORG_ERROR_COPY.listing} description={SETTLE.loadFailed} onRetry={() => retry()} retryLabel={SETTLE_ACTION.tryAgain} />;
}
