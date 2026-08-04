/**
 * Admin Review Service
 * Business logic for review management
 */

import { adminReviewRepository } from "@server/catalog/review.repository";
import { adminLogRepository } from "@server/shared/audit/audit.repository";
import type {
  ReviewListFilters,
  ReviewListResult,
  UpdateReviewInput,
  ReviewStats,
  AdminReview,
} from "@server/catalog/review.types";

export class AdminReviewService {
  /**
   * Get paginated list of reviews
   */
  async getReviews(filters: ReviewListFilters): Promise<ReviewListResult> {
    const { reviews, total } = await adminReviewRepository.getReviews(filters);

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const totalPages = Math.ceil(total / limit);

    return {
      reviews,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get single review by ID
   */
  async getReviewById(id: string): Promise<AdminReview | null> {
    return await adminReviewRepository.getReviewById(id);
  }

  /**
   * Update review (approve/unapprove, verify)
   */
  async updateReview(
    id: string,
    adminId: string,
    data: UpdateReviewInput
  ): Promise<AdminReview | null> {
    const review = await adminReviewRepository.updateReview(id, data);

    if (review) {
      const action =
        data.isApproved !== undefined
          ? data.isApproved
            ? "REVIEW_APPROVED"
            : "REVIEW_UNAPPROVED"
          : "REVIEW_UPDATED";

      await adminLogRepository.createLog({
        adminId,
        action,
        resource: "Review",
        resourceId: id,
        metadata: {
          changes: data,
          productName: review.productName,
          userName: review.userName,
        },
      });
    }

    return review;
  }

  /**
   * Delete review
   */
  async deleteReview(id: string, adminId: string): Promise<void> {
    const review = await adminReviewRepository.getReviewById(id);

    if (!review) {
      throw new Error("Review not found");
    }

    await adminReviewRepository.deleteReview(id);

    await adminLogRepository.createLog({
      adminId,
      action: "REVIEW_DELETED",
      resource: "Review",
      resourceId: id,
      metadata: {
        productName: review.productName,
        userName: review.userName,
        rating: review.rating,
      },
    });
  }

  /**
   * Get review statistics
   */
  async getReviewStats(): Promise<ReviewStats> {
    return await adminReviewRepository.getReviewStats();
  }
}

export const adminReviewService = new AdminReviewService();


