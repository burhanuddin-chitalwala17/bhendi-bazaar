"use client";

import { ErrorState } from "@/components/shared/states/ErrorState";
import { ACTION } from "@/components/channel/channel-copy";
import { LISTINGS } from "@/components/channel/listing-copy";

/** The Listings page could not load. `retry` re-renders the segment (Next 16). */
export default function ChannelListingsError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorState as="h1" title="Listings didn't load" description={LISTINGS.loadFailed} onRetry={() => retry()} retryLabel={ACTION.tryAgain} />;
}
