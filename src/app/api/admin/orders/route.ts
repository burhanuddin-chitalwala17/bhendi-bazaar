/**
 * Admin Orders API Routes
 * GET /api/admin/orders - List orders with filters
 * 
 * Query params: search, status, paymentStatus, dateFrom, dateTo, minAmount, maxAmount, page, limit, sortBy, sortOrder
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminOrderService } from "@server/checkout/admin.order.service";
import type { OrderListFilters } from "@server/checkout/admin.order.types";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { searchParams } = new URL(request.url);

    const filters: OrderListFilters = {
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      paymentStatus: searchParams.get("paymentStatus") || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      minAmount: searchParams.get("minAmount")
        ? parseFloat(searchParams.get("minAmount")!)
        : undefined,
      maxAmount: searchParams.get("maxAmount")
        ? parseFloat(searchParams.get("maxAmount")!)
        : undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      sortBy: (searchParams.get("sortBy") as any) || "createdAt",
      sortOrder: (searchParams.get("sortOrder") as any) || "desc",
    };

    const result = await adminOrderService.getOrders(filters);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch orders:");
  }
}


