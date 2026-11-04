"use client";

import { ErrorState } from "@/components/shared/states/ErrorState";
import { ADMIN_SHELL_COPY } from "./admin-copy";

/** Any admin page that failed to render: what happened, and the same request again. */
export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorState
      as="h1"
      title={ADMIN_SHELL_COPY.errorTitle}
      description={ADMIN_SHELL_COPY.errorDescription}
      onRetry={() => retry()}
    />
  );
}
