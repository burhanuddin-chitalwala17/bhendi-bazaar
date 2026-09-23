/**
 * GET /api/admin/reviews — the moderation queue.
 *
 * Every review the platform holds, in any of its three states: published, withdrawn by
 * the platform, or retracted by its author. Retracted ones are listed here and nowhere
 * else — a buyer's *Delete* removes their words from every surface a buyer or an org
 * can reach, and keeps them for the platform (ADR-0032).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { reviewService } from "@server/catalog/review.service";
import type { ReviewListFilters } from "@server/catalog/review.types";
import { toErrorResponse } from "@/lib/api-error-response";
import { resolvePageNumber, resolvePageSize } from "@server/shared/pagination";
import { reviewQuerySchema } from "@/lib/validation/schemas/admin.schemas";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { searchParams } = new URL(request.url);

    // Parsed, never cast. `sortBy` reaches Prisma's `orderBy` as a key, so an unchecked
    // string here is a column name chosen by the caller (Invariant 4).
    const query = reviewQuerySchema.parse(Object.fromEntries(searchParams));

    const filters: ReviewListFilters = {
      ...query,
      page: resolvePageNumber(searchParams.get("page")),
      limit: resolvePageSize(searchParams.get("limit")),
    };

    return NextResponse.json(await reviewService.getReviews(filters));
  } catch (error) {
    return toErrorResponse(error, "Could not fetch reviews:");
  }
}
