/**
 * POST /api/admin/shipments/[id]/cancel — the admin cancels a paid parcel until the courier collects
 * it, giving a reason; no fee for the shop (order-fulfilment D12, R10, Q28). Answers the AWB to
 * cancel on Shiprocket when it was booked.
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { shopCancelReason, shopCancelSchema } from "@/lib/validation/schemas/parcel-cancel.schema";
import { cancelParcel } from "@server/checkout/fulfilment-cancel";
import { PARCEL_ACTOR } from "@server/shipping/domain/shipping.types";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const input = shopCancelSchema.parse(await request.json());
    const result = await cancelParcel(id, { actor: PARCEL_ACTOR.ADMIN, name: session.user.name ?? null }, shopCancelReason(input));
    return NextResponse.json({ awb: result.awb });
  } catch (error) {
    return toErrorResponse(error, "Could not cancel the parcel");
  }
}
