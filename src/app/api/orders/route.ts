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


