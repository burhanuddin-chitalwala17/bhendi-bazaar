/**
 * Admin Dashboard API Routes
 * GET /api/admin/dashboard - Get dashboard statistics
 */

import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminDashboardService } from "@server/analytics/dashboard.service";

export async function GET() {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const stats = await adminDashboardService.getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch dashboard stats",
      },
      { status: 500 }
    );
  }
}


