/**
 * Shipping Providers API - Admin
 * GET /api/admin/shipping/providers
 * 
 * Fetch all shipping providers with statistics (Admin only)
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminShippingService } from "@server/shipping/services/admin.shipping.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET() {
  try {
    // Verify admin access
    await requirePlatformAdmin();

    // Get providers and stats
    const response = await adminShippingService.getAllProviders();

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch providers");
  }
}

