/**
 * Admin Dashboard Activities API
 * GET /api/admin/dashboard/activities - Get recent activities
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminDashboardService } from "@server/analytics/dashboard.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const activities = await adminDashboardService.getRecentActivities(limit);
    return NextResponse.json(activities);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch activities:");
  }
}


