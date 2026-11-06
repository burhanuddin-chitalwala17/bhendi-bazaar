"use client";

import { Button } from "@/components/ui/button";

import { REQUESTS_COPY as C } from "./requests-copy";
import { useRaiseRequest } from "./useRaiseRequest";

/** "Raise a request" (setup-requests Q36): no form, no message to write; the ticket shows here once raised. */
export function RaiseRequestButton({ orgId, channel, productId }: { orgId: string; channel: string; productId: string }) {
  const { raise, pending, nothing } = useRaiseRequest(orgId, channel, productId);
  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" className="min-h-10" pending={pending} onClick={raise}>
        {C.raiseRequest}
      </Button>
      <p className="text-small text-muted-foreground">{nothing ? C.nothingToRaise : C.raiseHint}</p>
    </div>
  );
}
