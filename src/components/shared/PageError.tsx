"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** What a page shows when it failed to render: the fact, a retry, and a way out. */
export function PageError({ reset, digest }: { reset: () => void; digest?: string }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-start gap-3 py-12 text-sm">
      <h1 className="text-lg font-semibold">Something went wrong on our side</h1>
      <p className="text-muted-foreground">
        Nothing you did caused this. Try again, or go back to the home page.
        {digest ? ` Reference: ${digest}.` : ""}
      </p>
      <div className="flex gap-2">
        <Button className="min-h-10" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline" className="min-h-10">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
