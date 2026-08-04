/**
 * Admin Review Service (Client-side)
 * Handles API calls for review management
 */

import type {
  AdminReview,
  ReviewListFilters,
  ReviewListResult,
} from "@/domain/admin";

class AdminReviewService {
  /**
   * Get paginated list of reviews
   */
  async getReviews(filters: ReviewListFilters = {}): Promise<ReviewListResult> {
    const params = new URLSearchParams();

    if (filters.search) params.append("search", filters.search);
    if (filters.productId) params.append("productId", filters.productId);
    if (filters.isApproved !== undefined)
      params.append("isApproved", String(filters.isApproved));
    if (filters.isVerified !== undefined)
      params.append("isVerified", String(filters.isVerified));
    if (filters.minRating) params.append("minRating", String(filters.minRating));
    if (filters.maxRating) params.append("maxRating", String(filters.maxRating));
    if (filters.page) params.append("page", String(filters.page));
    if (filters.limit) params.append("limit", String(filters.limit));
    if (filters.sortBy) params.append("sortBy", filters.sortBy);
    if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

    const response = await fetch(`/api/admin/reviews?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch reviews");
    }

    return response.json();
  }


  /**
   * Update review (approve/unapprove)
   */
  async updateReview(
    id: string,
    data: { isApproved?: boolean; isVerified?: boolean }
  ): Promise<AdminReview> {
    const response = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update review");
    }

    return response.json();
  }

  /**
   * Delete review
   */
  async deleteReview(id: string): Promise<void> {
    const response = await fetch(`/api/admin/reviews/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete review");
    }
  }
}

export const adminReviewApiClient = new AdminReviewService();

