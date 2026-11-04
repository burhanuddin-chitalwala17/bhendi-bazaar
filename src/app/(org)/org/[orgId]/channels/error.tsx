"use client";

import { Button } from "@/components/ui/button";
import { ACTION, PAGE_LOAD_FAILED } from "@/components/channel/channel-copy";

/** The Channels page could not load (ux.md "Retryable error"). */
export default function ChannelsError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-destructive bg-destructive/10 p-4 text-sm">
      <p>{PAGE_LOAD_FAILED}</p>
      <Button variant="outline" className="min-h-10 self-start" onClick={() => retry()}>
        {ACTION.tryAgain}
      </Button>
    </div>
  );
}
