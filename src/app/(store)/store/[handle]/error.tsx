"use client";

import { Button } from "@/components/ui/button";

/** A shop page that failed to load, inside the shop's own chrome (ux.md landing page, Retryable error). */
export default function ShopError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-store flex-col items-center gap-4 px-gutter py-section text-center">
      <p className="font-display text-title">Something went wrong. Try again.</p>
      <Button variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
