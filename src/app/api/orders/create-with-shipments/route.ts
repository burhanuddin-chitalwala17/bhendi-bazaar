/**
 * Create Order with Shipments API Route
 *
 * POST /api/orders/create-with-shipments - Create order with multiple shipments
 *
 * Flow:
 * 1. Rate limiting check
 * 2. Validate request with Zod
 * 3. Create order with shipments (pending fulfillment)
 * 4. Return order (payment will be processed on client)
 */

import { optionalActiveSession } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@server/checkout/order.service";
import { paymentService } from "@server/payments/payment.service";
import { OutOfStockError } from "@server/shared/domain-error";
import { toErrorResponse } from "@/lib/api-error-response";
import {
  orderRateLimit,
  getClientIp,
  formatTimeRemaining,
} from "@/lib/rate-limit";
import { validateRequest } from "@/lib/validation";
import { createOrderWithShipmentsSchema } from "@/lib/validation/schemas/order.schemas";

export async function POST(request: NextRequest) {
  // Rate limit check
  const ip = getClientIp(request);
  const { success, limit, remaining, reset } = await orderRateLimit.limit(ip);

  if (!success) {
    const timeRemaining = reset - Date.now();
    return NextResponse.json(
      {
        error: `Too many order requests. Please try again in ${formatTimeRemaining(
          timeRemaining,
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
      },
    );
  }

  // Outside the handler's try, so a suspended account answers 403 here rather than 500.
  const session = await optionalActiveSession().catch((error: unknown) => error as Error);
  if (session instanceof Error) return toErrorResponse(session, "Could not read your session");
  const userId = session?.user?.id;

  // Validate request body
  const validation = await validateRequest(
    request,
    createOrderWithShipmentsSchema,
  );

  if ("error" in validation) {
    return validation.error;
  }

  const input = { ...validation.data, userId };

  try {
    return NextResponse.json(
      await orderService.createOrderWithShipments(input),
      {
        status: 201,
      },
    );
  } catch (error) {
    // The item may not be sold — it may be held by an abandoned checkout. Release
    // those and retry once before refusing a buyer (checkout-abandonment D4); a
    // second failure means the stock is genuinely gone.
    if (error instanceof OutOfStockError) {
      const releasedAny = await paymentService.releaseHoldsOnProducts(
        error.productIds,
      );
      if (releasedAny) {
        return NextResponse.json(
          await orderService.createOrderWithShipments(input),
          {
            status: 201,
          },
        );
      }
    }
    // One envelope, and a 409 that stays a 409 — this handler used to answer 400 for
    // everything, so the client could not tell a sold-out item from a bad payload
    // (ADR-0013).
    return toErrorResponse(error, "Failed to create order with shipments");
  }
}
