/**
 * Admin Bulk Order Update API Route
 * POST /api/admin/orders/bulk-update - Bulk update order status
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminOrderService } from "@server/checkout/admin.order.service";

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { orderIds, status } = body;

    if (!Array.isArray(orderIds) || !status) {
      return NextResponse.json(
        { error: "orderIds (array) and status are required" },
        { status: 400 }
      );
    }

    const count = await adminOrderService.bulkUpdateStatus(
      orderIds,
      status,
      session.user.id
    );

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Failed to bulk update orders:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to bulk update orders",
      },
      { status: 400 }
    );
  }
}


