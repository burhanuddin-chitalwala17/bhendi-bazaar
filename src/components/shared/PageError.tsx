"use client";

import Link from "next/link";
import { PageShell } from "@/components/shared/page-shell";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { PAGE_ERROR_COPY } from "./shared-copy";

/** What a page shows when it failed to render: the fact, a retry, and a way out in the words. */
export function PageError({ retry, digest }: { retry: () => void; digest?: string }) {
  return (
    <PageShell width="narrow">
      <ErrorState
        as="h1"
        title={PAGE_ERROR_COPY.somethingWentWrongOnOur}
        description={
          <p>
            Nothing you did caused this. Try again, or go back to the{" "}
            <Link href="/" className="font-medium text-foreground underline underline-offset-4">
              {PAGE_ERROR_COPY.homePage}
            </Link>
            .{digest ? ` Reference: ${digest}.` : ""}
          </p>
        }
        onRetry={retry}
      />
    </PageShell>
  );
}

/** `error` is typed unknown by Next; only a server error carries a digest. */
export function digestOf(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string"
    ? error.digest
    : undefined;
}
