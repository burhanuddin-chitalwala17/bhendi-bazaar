/**
 * Order Lookup API Route
 *
 * POST /api/orders/lookup - Lookup order by code (for guest orders)
 */

import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@server/checkout/order.service";
import {
  apiRateLimit,
  getClientIp,
  formatTimeRemaining,
} from "@/lib/rate-limit";
import { validateRequest } from "@/lib/validation";
import { orderLookupSchema } from "@/lib/validation/schemas/order.schemas";

export async function POST(request: NextRequest) {
  // Rate limit check (using apiRateLimit for lookup)
  const ip = getClientIp(request);
  const { success, limit, remaining, reset } = await apiRateLimit.limit(ip);

  if (!success) {
    const timeRemaining = reset - Date.now();
    return NextResponse.json(
      {
        error: `Too many lookup requests. Please try again in ${formatTimeRemaining(
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
  const validation = await validateRequest(request, orderLookupSchema);

  if ("error" in validation) {
    return validation.error;
  }

  const { code } = validation.data;

  try {
    const order = await orderService.lookupOrderByCode(code);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to lookup order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to lookup order",
      },
      { status: 500 }
    );
  }
}

