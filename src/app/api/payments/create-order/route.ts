/**
 * Create Payment Order API Route
 *
 * POST /api/payments/create-order - Create a payment order with the gateway
 */

import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@server/payments/payment.service";
import { limitRequest } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { validateRequest } from "@/lib/validation";
import { createPaymentOrderSchema } from "@/lib/validation/schemas/payment.schemas";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const limited = await limitRequest(request, "POST /api/payments/create-order", { userId: session?.user?.id });
  if (limited) return limited;

  // Validate request body
  const validation = await validateRequest(request, createPaymentOrderSchema);

  if ("error" in validation) {
    return validation.error;
  }

  try {
    const paymentOrder = await paymentService.createPaymentOrder(
      validation.data,
    );

    return NextResponse.json(paymentOrder);
  } catch (error) {
    console.error("Failed to create payment order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create payment order",
      },
      { status: 400 },
    );
  }
}
