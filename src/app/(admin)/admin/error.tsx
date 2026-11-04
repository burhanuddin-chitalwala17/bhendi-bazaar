"use client";

import { ErrorState } from "@/components/shared/states/ErrorState";

/** Any admin page that failed to render: what happened, and the same request again. */
export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorState
      as="h1"
      title="This page didn't load"
      description="Something went wrong reading it. Nothing was changed; try again, and if it keeps failing, check the server log."
      onRetry={() => retry()}
    />
  );
}
