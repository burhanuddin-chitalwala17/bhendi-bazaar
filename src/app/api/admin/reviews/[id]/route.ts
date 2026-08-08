/**
 * Admin Single Review API Routes
 * GET /api/admin/reviews/[id] - Get review details
 * PATCH /api/admin/reviews/[id] - Update review
 * DELETE /api/admin/reviews/[id] - Delete review
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminReviewService } from "@server/catalog/review.service";
import { toErrorResponse } from "@/lib/api-error-response";
import { updateReviewSchema } from "@/lib/validation/schemas/admin.schemas";


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const body = updateReviewSchema.parse(await request.json());

    const review = await adminReviewService.updateReview(
      id,
      session.user.id,
      body
    );

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json(review);
  } catch (error) {
    return toErrorResponse(error, "Could not update review:");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    await adminReviewService.deleteReview(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Could not delete review:");
  }
}

