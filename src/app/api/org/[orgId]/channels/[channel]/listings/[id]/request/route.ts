/**
 * POST /api/org/[orgId]/channels/[channel]/listings/[id]/request — "Raise a request" (setup-requests
 * Q36): raises a ticket for every problem on this listing only we can fix, from what the server sees.
 * No body: what is raised is never a list the browser sends.
 */
import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { platformListingService } from "@server/channels/platform-listing.service";
import { requestService } from "@server/requests/request.service";

export const POST = withOrg<{ orgId: string; channel: string; id: string }>(async (_request, scope, params) => {
  const complaint = await platformListingService.complaint(scope.orgId, params.id, params.channel);
  // Never reopens: a done ticket stays Ready for the shop to fill (Q12); a send's own answer reopens.
  const raised = complaint ? await requestService.raiseFromEvents([complaint], new Date(), { reopen: false }) : 0;
  return NextResponse.json({ ok: true, raised });
});
