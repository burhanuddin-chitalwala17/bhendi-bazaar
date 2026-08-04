/**
 * Orders API Routes
 *
 * GET /api/orders - List all orders for authenticated user
 * POST /api/orders - Create a new order
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
import { createOrderSchema } from "@/lib/validation/schemas/order.schemas";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  try {
    const orders = await orderService.getOrdersByUserId(userId);
    return NextResponse.json(orders);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch orders",
      },
      { status: 500 }
    );
  }
}

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
  const validation = await validateRequest(request, createOrderSchema);

  if ("error" in validation) {
    return validation.error;
  }

  try {
    // Convert client-side items to server-side items
    const serverItems = validation.data.items.map((item) => {
      const { id, salePrice, ...rest } = item;

      // Build the server item - only include salePrice if it has a value
      const serverItem: any = {
        ...rest,
      };

      // Only add salePrice if it's a valid number (not null or undefined)
      if (typeof salePrice === "number") {
        serverItem.salePrice = salePrice;
      }

      return serverItem;
    });

    // Map validated data to CreateOrderInput format
    const createOrderData = {
      userId,
      items: serverItems,
      itemsTotal: validation.data.totals.subtotal,
      shippingTotal: validation.data.totals.shipping ?? 0,
      discount: validation.data.totals.discount ?? 0,
      grandTotal: validation.data.totals.total,
      address: validation.data.address,
      notes: validation.data.notes,
      paymentMethod: validation.data.paymentMethod,
      paymentStatus: validation.data.paymentStatus,
      // Note: Simple orders don't have shipments array
      // For multi-shipment orders, use /api/orders/create-with-shipments
      shipments: [], // Empty array for simple orders
    };

    const order = await orderService.createOrder(createOrderData);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create order",
      },
      { status: 400 }
    );
  }
}

