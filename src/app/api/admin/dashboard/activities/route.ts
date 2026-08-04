/**
 * Admin Dashboard Activities API
 * GET /api/admin/dashboard/activities - Get recent activities
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminDashboardService } from "@server/analytics/dashboard.service";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const activities = await adminDashboardService.getRecentActivities(limit);
    return NextResponse.json(activities);
  } catch (error) {
    console.error("Failed to fetch activities:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch activities",
      },
      { status: 500 }
    );
  }
}


