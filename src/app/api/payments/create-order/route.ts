/**
 * Create Payment Order API Route
 *
 * POST /api/payments/create-order - Create a payment order with the gateway
 */

import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@server/payments/payment.service";
import {
  paymentRateLimit,
  getClientIp,
  formatTimeRemaining,
} from "@/lib/rate-limit";
import { validateRequest } from "@/lib/validation";
import { createPaymentOrderSchema } from "@/lib/validation/schemas/payment.schemas";

export async function POST(request: NextRequest) {
  // Rate limit check
  const ip = getClientIp(request);
  const { success, limit, remaining, reset } = await paymentRateLimit.limit(ip);

  if (!success) {
    const timeRemaining = reset - Date.now();
    return NextResponse.json(
      {
        error: `Too many payment requests. Please try again in ${formatTimeRemaining(
          timeRemaining
        )}.`,
        retryAfter: Math.ceil(timeRemaining / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": Math.ceil(timeRemaining / 1000).toString(),
        },
      }
    );
  }

  // Validate request body
  const validation = await validateRequest(request, createPaymentOrderSchema);

  if ("error" in validation) {
    return validation.error;
  }

  try {
    const paymentOrder = await paymentService.createPaymentOrder(
      validation.data
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
      { status: 400 }
    );
  }
}

