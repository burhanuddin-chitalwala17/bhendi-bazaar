/**
 * Admin Single Order API Routes
 * GET /api/admin/orders/[id] - Get order details
 * PATCH /api/admin/orders/[id] - Update order status
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminOrderService } from "@server/checkout/admin.order.service";
import type { UpdateOrderStatusInput } from "@server/checkout/admin.order.types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const order = await adminOrderService.getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to fetch order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch order",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateOrderStatusInput;

    const order = await adminOrderService.updateOrderStatus(
      id,
      session.user.id,
      body
    );

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Failed to update order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update order",
      },
      { status: 400 }
    );
  }
}


