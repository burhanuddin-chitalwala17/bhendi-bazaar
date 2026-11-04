"use client";

import { useSearchParams } from "next/navigation";

import { ErrorState } from "@/components/shared/states/ErrorState";
import { CONFLICTS_TAB, CONFLICT_COPY, NOT_PACKED_COPY, QUEUE_COPY } from "@/components/order/pickups/pickups-copy";
import { ADMIN_SHELL_COPY } from "../../admin-copy";

/** ux.md "admin pickups" and "admin conflicts" Retryable error: the tab failed to load. */
export default function PickupsError({ retry }: { error: unknown; retry: () => void }) {
  const conflicts = useSearchParams().get("tab") === CONFLICTS_TAB;
  return (
    <ErrorState
      as="h1"
      title={conflicts ? CONFLICT_COPY.loadFailed : QUEUE_COPY.loadFailed}
      description={ADMIN_SHELL_COPY.nothingChanged}
      retryLabel={NOT_PACKED_COPY.tryAgain}
      onRetry={() => retry()}
    />
  );
}
