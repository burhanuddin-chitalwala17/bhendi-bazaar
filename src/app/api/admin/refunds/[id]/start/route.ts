/**
 * POST /api/admin/refunds/[id]/start — "Refund ₹{x}" (order-fulfilment D17, R14). No body: the
 * amount is the row's, computed by the server when it was owed (Invariant 1).
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { startRefund } from "@server/checkout/refund-start";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    return NextResponse.json(await startRefund(id, { id: session.user.id, name: session.user.name ?? null }));
  } catch (error) {
    return toErrorResponse(error, "Could not start the refund");
  }
}
