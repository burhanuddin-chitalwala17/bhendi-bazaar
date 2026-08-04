/**
 * Admin Abandoned Carts API Route
 * GET /api/admin/abandoned-carts - Get list of abandoned carts
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminCartService } from "@server/cart/admin.cart.service";
import type { AbandonedCartFilters } from "@server/cart/admin.cart.types";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);

    const filters: AbandonedCartFilters = {
      minValue: searchParams.get("minValue")
        ? parseFloat(searchParams.get("minValue")!)
        : undefined,
      minDays: searchParams.get("minDays")
        ? parseInt(searchParams.get("minDays")!)
        : 1,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      sortBy: (searchParams.get("sortBy") as any) || "updatedAt",
      sortOrder: (searchParams.get("sortOrder") as any) || "desc",
    };

    const result = await adminCartService.getAbandonedCarts(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch abandoned carts:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch abandoned carts",
      },
      { status: 500 }
    );
  }
}

