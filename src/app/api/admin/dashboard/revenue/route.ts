/**
 * Admin Dashboard Revenue Chart API
 * GET /api/admin/dashboard/revenue - Get revenue chart data
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminDashboardService } from "@server/analytics/dashboard.service";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");

    const revenueData = await adminDashboardService.getRevenueChart(days);
    return NextResponse.json(revenueData);
  } catch (error) {
    console.error("Failed to fetch revenue data:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch revenue data",
      },
      { status: 500 }
    );
  }
}


