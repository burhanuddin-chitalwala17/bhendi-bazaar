"use client";

import { PageError, digestOf } from "@/components/shared/PageError";

// Inside the storefront layout, so the header, tab bar and gutter stay (docs/GTM-READINESS.md B9).
export default function StorefrontError({ error, retry }: { error: unknown; retry: () => void }) {
  return <PageError retry={retry} digest={digestOf(error)} />;
}
