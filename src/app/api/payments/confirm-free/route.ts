/**
 * POST /api/payments/confirm-free — confirmation for zero-total orders.
 *
 * No gateway is involved, so the only verifiable fact is the persisted total being
 * zero — which the server checks itself. A non-zero order is refused.
 */
import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@server/payments/payment.service";
import { confirmFreeOrderSchema } from "@/lib/validation/schemas/payment.schemas";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(request: NextRequest) {
  try {
    const body = confirmFreeOrderSchema.parse(await request.json());
    const result = await paymentService.confirmFreeOrder(body.localOrderId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Order could not be confirmed");
  }
}
