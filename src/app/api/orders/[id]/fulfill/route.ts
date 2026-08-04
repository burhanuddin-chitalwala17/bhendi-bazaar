/**
 * Fulfill Order API Route (ADMIN ONLY)
 *
 * POST /api/orders/[orderId]/fulfill - Trigger automated fulfillment
 * 
 * ⚠️ NOTE: This route is NOT used during normal checkout flow.
 * Current implementation uses MANUAL fulfillment where admins:
 * 1. Create shipments on Shiprocket website
 * 2. Update tracking via PATCH /api/admin/shipments/[id]/tracking
 * 
 * This route is kept for:
 * - Future automation when volume increases
 * - Admin-triggered fulfillment of failed orders
 * - Bulk fulfillment operations
 * 
 * Actions performed:
 * - Create shipments with shipping providers (via API)
 * - Generate AWB numbers automatically
 * - Schedule pickups automatically
 * - Update tracking information
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { orderService } from "@server/checkout/order.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  
  // Require admin authentication for manual fulfillment trigger
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json(
      { error: "Unauthorized: Admin access required" },
      { status: 403 }
    );
  }

  const { id: orderId } = await params;

  if (!orderId) {
    return NextResponse.json(
      { error: "Order ID is required" },
      { status: 400 }
    );
  }

  try {
    // Trigger automated fulfillment (creates shipments with providers)
    await orderService.fulfillOrder(orderId);

    return NextResponse.json({ 
      success: true,
      message: "Order fulfillment completed. Shipments created with providers.",
      note: "This is automated fulfillment. For manual process, use shipment tracking update API."
    });

  } catch (error) {
    console.error(`Failed to fulfill order ${orderId}:`, error);
    
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fulfill order",
      },
      { status: 500 }
    );
  }
}
