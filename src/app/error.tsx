"use client";

import { PageError } from "@/components/shared/PageError";

// Inside the root layout, so the header and footer stay (docs/GTM-READINESS.md B9).
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError reset={reset} digest={error.digest} />;
}
