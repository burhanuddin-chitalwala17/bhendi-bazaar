/**
 * Admin Single Review API Routes
 * GET /api/admin/reviews/[id] - Get review details
 * PATCH /api/admin/reviews/[id] - Update review
 * DELETE /api/admin/reviews/[id] - Delete review
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminReviewService } from "@server/catalog/review.service";
import type { UpdateReviewInput } from "@server/catalog/review.types";


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateReviewInput;

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
    console.error("Failed to update review:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update review",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    await adminReviewService.deleteReview(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete review:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete review",
      },
      { status: 400 }
    );
  }
}

