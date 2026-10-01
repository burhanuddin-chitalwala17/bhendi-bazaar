import { apiRequest } from "@/lib/api-client";
import type { ReviewDto, ReviewPageDto } from "@server/catalog/review.types";
import type { ReviewSubmissionInput } from "@/lib/validation/schemas/review.schema";

/** The browser's side of reviews. Relative paths only — the origin is never hardcoded (CLAUDE.md). */
export const reviewApiClient = {
  /** A further page of a product's reviews (R3). */
  getPage(productId: string, page: number): Promise<ReviewPageDto> {
    return apiRequest(`/api/products/${productId}/reviews?page=${page}`, { cache: "no-store" });
  },

  /** Write a review of this product (R7). */
  create(productId: string, input: ReviewSubmissionInput): Promise<ReviewDto> {
    return apiRequest(`/api/products/${productId}/reviews`, { method: "POST", body: input });
  },

  /** Edit one of your own reviews (R9). */
  update(reviewId: string, input: ReviewSubmissionInput): Promise<void> {
    return apiRequest(`/api/reviews/${reviewId}`, { method: "PATCH", body: input });
  },

  /** Delete one of your own reviews (R9). */
  remove(reviewId: string): Promise<void> {
    return apiRequest(`/api/reviews/${reviewId}`, { method: "DELETE" });
  },
};
