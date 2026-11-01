/**
 * POST /api/org/[orgId]/shipments/[id]/cancel — the shop cancels its own paid parcel while it is
 * still being packed, giving a reason (order-fulfilment D12, R10, R12a). Another shop's parcel is 404.
 */
import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { shopCancelReason, shopCancelSchema } from "@/lib/validation/schemas/parcel-cancel.schema";
import { cancelParcel } from "@server/checkout/fulfilment-cancel";
import { PARCEL_ACTOR } from "@server/shipping/domain/shipping.types";

export const POST = withOrg<{ orgId: string; id: string }>(async (request, scope, params) => {
  const input = shopCancelSchema.parse(await request.json());
  const result = await cancelParcel(params.id, { actor: PARCEL_ACTOR.SHOP, orgId: scope.orgId }, shopCancelReason(input));
  return NextResponse.json({ feePaise: result.feePaise });
});
