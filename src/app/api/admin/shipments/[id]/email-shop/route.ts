/**
 * POST /api/admin/shipments/[id]/email-shop — the admin's "Email shop" on a paid parcel not packed
 * 36 h on (order-fulfilment ux.md "admin not-packed flag", R3a). Written as a notice; the worker sends it.
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { emailShopAboutParcel } from "@server/checkout/fulfilment-nudges";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await params;
    return NextResponse.json(await emailShopAboutParcel(id));
  } catch (error) {
    return toErrorResponse(error, "Could not email the shop");
  }
}
