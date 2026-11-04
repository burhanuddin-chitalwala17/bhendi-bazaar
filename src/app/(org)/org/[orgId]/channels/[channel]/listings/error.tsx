"use client";

import { ErrorState } from "@/components/shared/states/ErrorState";
import { ACTION } from "@/components/channel/channel-copy";
import { LISTINGS } from "@/components/channel/listing-copy";
import { ORG_ERROR_COPY } from "@/components/org/pages-copy";

/** The Listings page could not load. `retry` re-renders the segment (Next 16). */
export default function ChannelListingsError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorState as="h1" title={ORG_ERROR_COPY.listings} description={LISTINGS.loadFailed} onRetry={() => retry()} retryLabel={ACTION.tryAgain} />;
}
