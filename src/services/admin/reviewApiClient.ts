/**
 * The moderation queue's client (product-reviews R15, R16).
 *
 * There is no `deleteReview`. A review carries attribution and is never destroyed — the
 * platform withdraws it and keeps it readable here (ADR-0032).
 */

import type {
  AdminReview,
  ReviewListFilters,
  ReviewListResult,
} from "@/domain/admin";
import { readApiError } from "@/lib/api-error";

class AdminReviewService {
  /** One page of the queue, in whichever state the filter asks for. */
  async getReviews(filters: ReviewListFilters = {}): Promise<ReviewListResult> {
    const params = new URLSearchParams();

    if (filters.search) params.append("search", filters.search);
    if (filters.productId) params.append("productId", filters.productId);
    if (filters.state) params.append("state", filters.state);
    if (filters.isVerified !== undefined)
      params.append("isVerified", String(filters.isVerified));
    if (filters.minRating) params.append("minRating", String(filters.minRating));
    if (filters.maxRating) params.append("maxRating", String(filters.maxRating));
    if (filters.page) params.append("page", String(filters.page));
    if (filters.limit) params.append("limit", String(filters.limit));
    if (filters.sortBy) params.append("sortBy", filters.sortBy);
    if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

    const response = await fetch(`/api/admin/reviews?${params.toString()}`);
    if (!response.ok) throw await readApiError(response);
    return response.json();
  }

  /** One review in full, for the detail panel. */
  async getReview(id: string): Promise<AdminReview> {
    const response = await fetch(`/api/admin/reviews/${id}`);
    if (!response.ok) throw await readApiError(response);
    return response.json();
  }

  /** Withdraw a review, or restore one. The only state moderation may write. */
  async updateReview(
    id: string,
    data: { withdrawn: boolean },
  ): Promise<AdminReview> {
    const response = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw await readApiError(response);
    return response.json();
  }
}

export const adminReviewApiClient = new AdminReviewService();
