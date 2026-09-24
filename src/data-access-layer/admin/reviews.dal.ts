// DATA ACCESS LAYER FOR ADMIN REVIEWS

import { cache } from "react";
import { reviewRepository } from "@server/catalog/review.repository";
import type { ReviewListFilters, ReviewListResult } from "@server/catalog/review.types";

/**
 * The moderation queue, read on the server
 * ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 */
class ReviewsDAL {
  list = cache(async (filters: ReviewListFilters): Promise<ReviewListResult> => {
    const { reviews, total } = await reviewRepository.getReviews(filters);
    const limit = filters.limit ?? 20;
    return {
      reviews,
      total,
      page: filters.page ?? 1,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  });
}

export const adminReviewsDAL = new ReviewsDAL();
