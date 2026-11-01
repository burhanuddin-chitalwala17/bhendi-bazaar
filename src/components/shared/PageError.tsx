"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page-shell";

/** What a page shows when it failed to render: the fact, a retry, and a way out. */
export function PageError({ retry, digest }: { retry: () => void; digest?: string }) {
  return (
    <PageShell width="narrow" className="py-12">
      <div role="alert" className="flex flex-col items-start gap-3 text-sm">
        <h1 className="text-lg font-semibold">Something went wrong on our side</h1>
        <p className="text-muted-foreground">
          Nothing you did caused this. Try again, or go back to the home page.
          {digest ? ` Reference: ${digest}.` : ""}
        </p>
        <div className="flex gap-2">
          <Button className="min-h-10" onClick={retry}>
            Try again
          </Button>
          <Button asChild variant="outline" className="min-h-10">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

/** `error` is typed unknown by Next; only a server error carries a digest. */
export function digestOf(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string"
    ? error.digest
    : undefined;
}
