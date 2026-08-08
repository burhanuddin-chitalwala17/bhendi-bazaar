/**
 * Admin Reviews API Routes
 * GET /api/admin/reviews - List reviews with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminReviewService } from "@server/catalog/review.service";
import type { ReviewListFilters } from "@server/catalog/review.types";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { searchParams } = new URL(request.url);

    const filters: ReviewListFilters = {
      search: searchParams.get("search") || undefined,
      productId: searchParams.get("productId") || undefined,
      isApproved:
        searchParams.get("isApproved") === "true"
          ? true
          : searchParams.get("isApproved") === "false"
          ? false
          : undefined,
      isVerified:
        searchParams.get("isVerified") === "true"
          ? true
          : searchParams.get("isVerified") === "false"
          ? false
          : undefined,
      minRating: searchParams.get("minRating")
        ? parseInt(searchParams.get("minRating")!)
        : undefined,
      maxRating: searchParams.get("maxRating")
        ? parseInt(searchParams.get("maxRating")!)
        : undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      sortBy: (searchParams.get("sortBy") as any) || "createdAt",
      sortOrder: (searchParams.get("sortOrder") as any) || "desc",
    };

    const result = await adminReviewService.getReviews(filters);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch reviews:");
  }
}

