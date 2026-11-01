"use client";

import { Button } from "@/components/ui/button";
import { LOOK_COPY } from "@/components/org/look/look-copy";

/** The picker could not read the shop (ux.md picker, Retryable error). */
export default function LookPickerError({ retry }: { error: Error; retry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-destructive bg-destructive/10 p-4 text-sm">
      <p>{LOOK_COPY.themesFailed}</p>
      <Button variant="outline" className="min-h-11 self-start" onClick={() => retry()}>
        {LOOK_COPY.tryAgain}
      </Button>
    </div>
  );
}
