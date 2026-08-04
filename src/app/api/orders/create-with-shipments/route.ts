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

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { orderService } from "@server/checkout/order.service";
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

  const session = await getServerSession(authOptions);

  // Orders can be created by both authenticated users and guests
  const userId = session?.user ? (session.user as any).id : undefined;

  // Validate request body
  const validation = await validateRequest(
    request,
    createOrderWithShipmentsSchema
  );

  if ("error" in validation) {
    return validation.error;
  }

  try {
    // Create order with shipments (pending fulfillment)
    const order = await orderService.createOrderWithShipments({
      ...validation.data,
      userId,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Failed to create order with shipments:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create order with shipments",
      },
      { status: 400 }
    );
  }
}
