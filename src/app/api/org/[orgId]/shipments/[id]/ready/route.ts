/**
 * POST /api/org/[orgId]/shipments/[id]/ready — the shop marks its own paid parcel packed and
 * ready (order-fulfilment D6, spec R3, A1). Another shop's parcel, or an unpaid one, is 404.
 */
import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { markParcelReady } from "@server/checkout/fulfilment.service";

// No body: the parcel and the shop are the URL and the session.
export const POST = withOrg<{ orgId: string; id: string }>(async (_request, scope, params) => {
  await markParcelReady(params.id, scope.orgId);
  return NextResponse.json({ ok: true });
});
