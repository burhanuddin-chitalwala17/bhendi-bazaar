/**
 * DELETE /api/org/[orgId]/bidding/[id] — calls the event off.
 *
 * Cancellation, never deletion: the bids already placed are a record of what people
 * offered, and an event may already be named by an audit line (spec R27, ADR-0020).
 * The org scope is part of the update's `where`, so another organisation's event id
 * cancels nothing rather than cancelling it.
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { biddingService } from "@server/bidding/bidding.service";

export const DELETE = withOrg<{ orgId: string; id: string }>(
  async (_request, scope, params) => {
    await biddingService.cancel(params.id, scope.orgId);
    return NextResponse.json({ cancelled: true });
  }
);
