/**
 * Admin Dashboard API Routes
 * GET /api/admin/dashboard - Get dashboard statistics
 */

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminDashboardService } from "@server/analytics/dashboard.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET() {
  try {
    await requirePlatformAdmin();
    const stats = await adminDashboardService.getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch dashboard stats:");
  }
}


