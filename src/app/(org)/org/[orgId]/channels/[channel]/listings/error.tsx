"use client";

import { Button } from "@/components/ui/button";
import { ACTION } from "@/components/channel/channel-copy";
import { LISTINGS } from "@/components/channel/listing-copy";

/** The Listings page could not load. */
export default function ChannelListingsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-destructive bg-destructive/10 p-4 text-sm">
      <p>{LISTINGS.loadFailed}</p>
      <Button variant="outline" className="min-h-10 self-start" onClick={reset}>
        {ACTION.tryAgain}
      </Button>
    </div>
  );
}
