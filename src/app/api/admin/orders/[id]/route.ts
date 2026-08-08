/**
 * Admin Single Order API Routes
 * GET /api/admin/orders/[id] - Get order details
 * PATCH /api/admin/orders/[id] - Update order status
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminOrderService } from "@server/checkout/admin.order.service";
import { toErrorResponse } from "@/lib/api-error-response";
import { updateOrderStatusSchema } from "@/lib/validation/schemas/admin.schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const order = await adminOrderService.getOrderById(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch order:");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const body = updateOrderStatusSchema.parse(await request.json());

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
    return toErrorResponse(error, "Could not update order:");
  }
}


