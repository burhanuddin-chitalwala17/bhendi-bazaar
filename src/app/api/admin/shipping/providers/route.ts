/**
 * Shipping Providers API - Admin
 * GET /api/admin/shipping/providers
 * 
 * Fetch all shipping providers with statistics (Admin only)
 */

import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminShippingService } from "@server/shipping/services/admin.shipping.service";

export async function GET() {
  try {
    // Verify admin access
    const session = await verifyAdminSession();
    if (session instanceof NextResponse) {
      return session;
    }

    // Get providers and stats
    const response = await adminShippingService.getAllProviders();

    return NextResponse.json(response);
  } catch (error) {
    console.error("Get providers error:", error);

    return NextResponse.json(
      {
        success: false,
        providers: [],
        error:
          error instanceof Error ? error.message : "Failed to fetch providers",
      },
      { status: 500 }
    );
  }
}

