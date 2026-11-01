/**
 * POST  /api/admin/shipments/[id]/booking — the admin books a ready parcel by hand (order-fulfilment D11, R5).
 * PATCH /api/admin/shipments/[id]/booking — moves its dates, compare-and-set on the date the admin saw.
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { bookingSchema, pickupDateChangeSchema } from "@/lib/validation/schemas/booking.schema";
import { bookPickup, changePickupDates } from "@server/checkout/fulfilment-booking";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const input = bookingSchema.parse(await request.json());
    await bookPickup(id, input, { name: session.user.name ?? null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Could not book the pickup");
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const input = pickupDateChangeSchema.parse(await request.json());
    await changePickupDates(id, input, { name: session.user.name ?? null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Could not change the pickup date");
  }
}
