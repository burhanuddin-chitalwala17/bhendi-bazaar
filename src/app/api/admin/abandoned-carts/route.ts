/**
 * Admin Abandoned Carts API Route
 * GET /api/admin/abandoned-carts - Get list of abandoned carts
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminCartService } from "@server/cart/admin.cart.service";
import type { AbandonedCartFilters } from "@server/cart/admin.cart.types";
import { toErrorResponse } from "@/lib/api-error-response";
import {
  resolvePageNumber,
  resolvePageSize,
  resolveSortBy,
  resolveSortOrder,
} from "@server/shared/pagination";

/** The columns this listing may be ordered by — the same set abandoned-carts filters declare. */
const SORTABLE = ["updatedAt", "totalValue"] as const;

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { searchParams } = new URL(request.url);

    const filters: AbandonedCartFilters = {
      minValue: searchParams.get("minValue")
        ? parseFloat(searchParams.get("minValue")!)
        : undefined,
      minDays: searchParams.get("minDays")
        ? parseInt(searchParams.get("minDays")!)
        : 1,
      page: resolvePageNumber(searchParams.get("page")),
      limit: resolvePageSize(searchParams.get("limit")),
      sortBy: resolveSortBy(searchParams.get("sortBy"), SORTABLE, "updatedAt"),
      sortOrder: resolveSortOrder(searchParams.get("sortOrder"), "desc"),
    };

    const result = await adminCartService.getAbandonedCarts(filters);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch abandoned carts:");
  }
}
