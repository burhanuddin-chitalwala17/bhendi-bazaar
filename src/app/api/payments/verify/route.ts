/**
 * Verify Payment API Route
 *
 * POST /api/payments/verify - Verify payment signature
 */

import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@server/payments/payment.service";
import type { VerifyPaymentInput } from "@server/payments/payment.types";

export async function POST(request: NextRequest) {
  try {
    const body: VerifyPaymentInput = await request.json();

    const result = await paymentService.verifyPayment(body);

    if (!result.isValid) {
      return NextResponse.json(
        { error: result.error || "Payment verification failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Failed to verify payment:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify payment",
      },
      { status: 400 }
    );
  }
}

