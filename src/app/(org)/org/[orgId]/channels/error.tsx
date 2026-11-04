"use client";

import { ErrorState } from "@/components/shared/states/ErrorState";
import { ACTION, PAGE_LOAD_FAILED } from "@/components/channel/channel-copy";
import { ORG_ERROR_COPY } from "@/components/org/pages-copy";

/** The Channels page could not load (ux.md "Retryable error"). `retry` re-renders the segment (Next 16). */
export default function ChannelsError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorState as="h1" title={ORG_ERROR_COPY.channels} description={PAGE_LOAD_FAILED} onRetry={() => retry()} retryLabel={ACTION.tryAgain} />;
}
