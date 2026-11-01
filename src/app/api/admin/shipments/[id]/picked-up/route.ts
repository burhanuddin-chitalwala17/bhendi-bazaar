/**
 * POST /api/admin/shipments/[id]/picked-up — "Mark picked up" when the courier sends no update
 * (order-fulfilment Q4, D11). No body: the parcel is the URL.
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { markPickedUp } from "@server/checkout/fulfilment-booking";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    await markPickedUp(id, { name: session.user.name ?? null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Could not mark the parcel picked up");
  }
}
