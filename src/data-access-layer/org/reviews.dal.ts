import { cache } from "react";
import { reviewRepository } from "@server/catalog/review.repository";

/**
 * What an org sees about its own products' reviews (product-reviews R17).
 *
 * Read-only: moderation stays with the platform. Withdrawn reviews are included so an
 * org can see what was said and that it was acted on; reviews their authors retracted
 * are not, and are filtered in the repository rather than here (ADR-0032).
 */
class OrgReviewsDAL {
  getReviews = cache(async (orgId: string, page = 1) => {
    const { reviews, total, limit } = await reviewRepository.getReviewsForOrg(
      orgId,
      page,
    );
    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title ?? null,
        comment: r.comment ?? null,
        isWithdrawn: r.withdrawnAt !== null,
        isVerified: r.isVerified,
        createdAt: r.createdAt.toISOString(),
        product: r.product,
        // The name frozen onto the review, not the account's name today (R11).
        reviewerName: r.userName,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export const orgReviewsDAL = new OrgReviewsDAL();
