"use client";

import { useRouter } from "next/navigation";
import { LISTINGS } from "./listing-copy";
import { useReadProgress } from "./useReadProgress";

/** While a read runs, follow its progress and refresh the page when there is something new to show (D10). */
export function ReadProgressRefresher({ orgId, channel, running }: { orgId: string; channel: string; running: boolean }) {
  const router = useRouter();
  const { gaveUp } = useReadProgress(orgId, channel, running, () => router.refresh());
  if (!gaveUp) return null;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {LISTINGS.stillReading}
    </p>
  );
}
