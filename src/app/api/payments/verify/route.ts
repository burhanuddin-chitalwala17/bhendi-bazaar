/**
 * POST /api/payments/verify — the browser-return confirmation trigger.
 *
 * A writer, not a check (ADR-0005): verifies the signature, matches the persisted
 * order, and performs the paid transition — the same routine the webhook calls, so
 * whichever arrives first wins and the other becomes a no-op.
 */
import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@server/payments/payment.service";
import { verifyPaymentSchema } from "@/lib/validation/schemas/payment.schemas";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(request: NextRequest) {
  try {
    const body = verifyPaymentSchema.parse(await request.json());

    const result = await paymentService.confirmPayment({
      localOrderId: body.localOrderId,
      gatewayOrderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Payment could not be confirmed");
  }
}
