/**
 * Orders API Routes
 *
 * GET /api/orders - List all orders for authenticated user
 */

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/admin-auth";
import { orderService } from "@server/checkout/order.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET() {
  try {
    const session = await requireSession();
    const orders = await orderService.getOrdersByUserId(session.user.id);
    return NextResponse.json(orders);
  } catch (error) {
    return toErrorResponse(error, "Could not load your orders");
  }
}
