/**
 * Order by ID API Route
 *
 * GET /api/orders/[id] - Get a single order by ID
 * PATCH /api/orders/[id] - Update an order (payment status, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { orderService } from "@server/checkout/order.service";
import type { UpdateOrderInput } from "@server/checkout/order.types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  // Get userId if authenticated
  const userId = session?.user ? (session.user as any).id : undefined;

  try {
    const order = await orderService.getOrderById(id, userId);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to fetch order:", error);

    // Handle authorization errors
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch order",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  // Get userId if authenticated
  const userId = session?.user ? (session.user as any).id : undefined;

  let body: UpdateOrderInput;
  try {
    body = (await request.json()) as UpdateOrderInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const order = await orderService.updateOrder(id, body, userId);
    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to update order:", error);

    // Handle authorization errors
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update order",
      },
      { status: 400 }
    );
  }
}

