"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@server/shared/routes";

import { REQUESTS_COPY as C } from "./requests-copy";
import { useRaiseRequest } from "./useRaiseRequest";

/** "Raise a request" (setup-requests Q36): no form, no message to write; the ticket shows here once raised. */
export function RaiseRequestButton({ orgId, channel, productId }: { orgId: string; channel: string; productId: string }) {
  const { raise, pending, outcome } = useRaiseRequest(orgId, channel, productId);
  if (outcome === "raised") {
    return (
      <div className="flex flex-col items-start gap-1">
        <p className="text-small">{C.raised}</p>
        <RequestsLink orgId={orgId} />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" className="min-h-10" pending={pending} onClick={raise}>
        {C.raiseRequest}
      </Button>
      <p className="text-small text-muted-foreground">{outcome === "nothing" ? C.nothingToRaise : C.raiseHint}</p>
    </div>
  );
}

/** "See your requests": the shop follows every ticket on its Requests page (Q33). */
export function RequestsLink({ orgId }: { orgId: string }) {
  return (
    <Button asChild variant="link" size="sm" className="min-h-10 px-0">
      <Link href={ROUTES.org.requests(orgId)}>{C.viewRequests}</Link>
    </Button>
  );
}
