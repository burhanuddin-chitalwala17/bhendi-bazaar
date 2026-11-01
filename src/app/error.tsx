"use client";

import { PageError, digestOf } from "@/components/shared/PageError";

// The last resort above every layout group; a storefront page fails inside its own shell
// ((main)/error.tsx). `retry` refetches, so a server error is actually tried again.
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="px-4">
      <PageError retry={retry} digest={digestOf(error)} />
    </div>
  );
}
