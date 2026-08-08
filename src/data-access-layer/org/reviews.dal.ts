import { cache } from "react";
import { adminReviewRepository } from "@server/catalog/review.repository";

/** Read-only: an org sees reviews on its products; moderation stays platform. */
class OrgReviewsDAL {
  getReviews = cache(async (orgId: string, page = 1) => {
    const { reviews, total, limit } = await adminReviewRepository.getReviewsForOrg(orgId, page);
    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment ?? null,
        isApproved: r.isApproved,
        isVerified: r.isVerified,
        createdAt: r.createdAt.toISOString(),
        product: r.product,
        reviewerName: r.user?.name ?? "Anonymous",
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export const orgReviewsDAL = new OrgReviewsDAL();
