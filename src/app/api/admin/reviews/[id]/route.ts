/**
 * PATCH /api/admin/reviews/[id] — withdraw a review, or restore it.
 *
 * There is no DELETE. A review carries attribution, so the platform withdraws it and keeps it;
 * the only other way one leaves a buyer's view is its own author retracting it, which is their
 * route, not this one (ADR-0032, product-reviews R15/R16).
 *
 * There is no GET either, any more. The detail panel is rendered from the queue's own server
 * read, which already carries the full comment and the media, so fetching the same review again
 * was a round trip for data the page held ([ADR-0034]).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { reviewService } from "@server/catalog/review.service";
import { toErrorResponse } from "@/lib/api-error-response";
import { updateReviewSchema } from "@/lib/validation/schemas/admin.schemas";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const body = updateReviewSchema.parse(await request.json());

    const review = await reviewService.updateReview(id, session.user.id, body);

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json(review);
  } catch (error) {
    return toErrorResponse(error, "Could not update review:");
  }
}
