"use client";

import { ErrorState } from "@/components/shared/states/ErrorState";
import { LOOK_COPY } from "@/components/org/look/look-copy";
import { ORG_ERROR_COPY } from "@/components/org/pages-copy";

/** The picker could not read the shop (ux.md picker, Retryable error). `retry` re-renders the segment (Next 16). */
export default function LookPickerError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorState as="h1" title={ORG_ERROR_COPY.looks} description={LOOK_COPY.themesFailed} onRetry={() => retry()} retryLabel={LOOK_COPY.tryAgain} />;
}
