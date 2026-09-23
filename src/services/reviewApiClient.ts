import { readApiError } from "@/lib/api-error";
import type { ReviewDto, ReviewPageDto } from "@server/catalog/review.types";
import type { ReviewSubmissionInput } from "@/lib/validation/schemas/review.schema";

/**
 * The browser's side of reviews.
 *
 * Every failure comes back as an `ApiError` through `readApiError`, which is what lets
 * `useServerForm` drop a field-attributed message onto its field (ADR-0013). Relative
 * paths only — the origin is never hardcoded (CLAUDE.md).
 */
export const reviewApiClient = {
  /** A further page of a product's reviews (R3). */
  async getPage(productId: string, page: number): Promise<ReviewPageDto> {
    const response = await fetch(
      `/api/products/${productId}/reviews?page=${page}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw await readApiError(response);
    return response.json();
  },

  /** Write a review of this product (R7). */
  async create(
    productId: string,
    input: ReviewSubmissionInput,
  ): Promise<ReviewDto> {
    const response = await fetch(`/api/products/${productId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await readApiError(response);
    return response.json();
  },

  /** Edit one of your own reviews (R9). */
  async update(reviewId: string, input: ReviewSubmissionInput): Promise<void> {
    const response = await fetch(`/api/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await readApiError(response);
  },

  /** Delete one of your own reviews (R9). */
  async remove(reviewId: string): Promise<void> {
    const response = await fetch(`/api/reviews/${reviewId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw await readApiError(response);
  },
};
