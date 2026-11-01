/**
 * POST /api/orders/[orderId]/shipments/[id]/cancel — a signed-in buyer cancels a parcel of their own
 * paid order while the shop is still packing it (order-fulfilment D12, R10, Q13). A guest cannot:
 * their order page is readable by id alone (Q31). Someone else's parcel is 404.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-config";
import { limitRequest } from "@/lib/rate-limit";
import { toErrorResponse } from "@/lib/api-error-response";
import { buyerCancelReason, buyerCancelSchema } from "@/lib/validation/schemas/parcel-cancel.schema";
import { cancelParcel } from "@server/checkout/fulfilment-cancel";
import { PARCEL_ACTOR } from "@server/shipping/domain/shipping.types";
import { NotFoundError } from "@server/shared/domain-error";

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string; id: string }> }) {
  const session = await getServerSession(authOptions);
  const limited = await limitRequest(request, "POST /api/orders/[orderId]/shipments/[id]/cancel", { userId: session?.user?.id });
  if (limited) return limited;
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { orderId, id } = await params;
    const input = buyerCancelSchema.parse(await request.json());
    const result = await cancelParcel(id, { actor: PARCEL_ACTOR.BUYER, userId: session.user.id, orderId }, buyerCancelReason(input));
    return NextResponse.json({ refundPaise: result.refundPaise });
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return toErrorResponse(error, "Could not cancel");
  }
}
