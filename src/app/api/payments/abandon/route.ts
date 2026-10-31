/**
 * POST /api/payments/abandon — the buyer gave up on the payment window.
 *
 * A request to *reconsider*, not an assertion: the service asks the gateway what
 * actually happened and confirms, holds, or releases accordingly
 * (checkout-abandonment D1/D2). A browser that never calls this changes nothing —
 * the sweep reaches the same conclusion later.
 */
import { optionalActiveSession } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@server/payments/payment.service";
import { abandonPaymentSchema } from "@/lib/validation/schemas/payment.schemas";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(request: NextRequest) {
  try {
    const body = abandonPaymentSchema.parse(await request.json());
    const session = await optionalActiveSession();

    const result = await paymentService.releaseIfUnpaid(body.localOrderId, {
      userId: session?.user?.id ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Could not release the order");
  }
}
