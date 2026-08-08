/**
 * Admin Review Repository
 * Handles database operations for review management
 */

import { prisma } from "@server/shared/prisma";
import { Prisma } from "@prisma/client";
import type {
  AdminReview,
  ReviewListFilters,
  UpdateReviewInput,
  ReviewStats,
} from "@server/catalog/review.types";

export class AdminReviewRepository {
  /**
   * Get paginated list of reviews with filters
   */
  async getReviews(filters: ReviewListFilters) {
    const {
      search,
      productId,
      isApproved,
      isVerified,
      minRating,
      maxRating,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};

    if (search) {
      where.OR = [
        { userName: { contains: search, mode: "insensitive" } },
        { comment: { contains: search, mode: "insensitive" } },
        { product: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (productId) {
      where.productId = productId;
    }

    if (typeof isApproved === "boolean") {
      where.isApproved = isApproved;
    }

    if (typeof isVerified === "boolean") {
      where.isVerified = isVerified;
    }

    if (minRating !== undefined || maxRating !== undefined) {
      where.rating = {};
      if (minRating !== undefined) where.rating.gte = minRating;
      if (maxRating !== undefined) where.rating.lte = maxRating;
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    const adminReviews: AdminReview[] = reviews.map((review) => ({
      id: review.id,
      productId: review.productId,
      productName: review.product.name,
      userId: review.userId,
      userName: review.userName,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      isVerified: review.isVerified,
      isApproved: review.isApproved,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    }));

    return { reviews: adminReviews, total };
  }

  /**
   * Get single review by ID
   */
  /** Reviews on one org's products. Read-only: moderation and deletion stay platform. */
  async getReviewsForOrg(orgId: string, page = 1, limit = 20) {
    const where = { product: { orgId } };
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          comment: true,
          isApproved: true,
          isVerified: true,
          createdAt: true,
          product: { select: { id: true, name: true, slug: true, thumbnail: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);
    return { reviews, total, page, limit };
  }

  async getReviewById(id: string): Promise<AdminReview | null> {
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!review) return null;

    return {
      id: review.id,
      productId: review.productId,
      productName: review.product.name,
      userId: review.userId,
      userName: review.userName,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      isVerified: review.isVerified,
      isApproved: review.isApproved,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  /**
   * Update review
   */
  async updateReview(
    id: string,
    data: UpdateReviewInput
  ): Promise<AdminReview | null> {
    const review = await prisma.review.update({
      where: { id },
      data,
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      id: review.id,
      productId: review.productId,
      productName: review.product.name,
      userId: review.userId,
      userName: review.userName,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      isVerified: review.isVerified,
      isApproved: review.isApproved,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  /**
   * Delete review
   */
  async deleteReview(id: string): Promise<void> {
    await prisma.review.delete({
      where: { id },
    });
  }

  /**
   * Get review statistics
   */
  async getReviewStats(): Promise<ReviewStats> {
    const [totalReviews, pendingReviews, avgRating] = await Promise.all([
      prisma.review.count(),
      prisma.review.count({ where: { isApproved: false } }),
      prisma.review.aggregate({
        _avg: {
          rating: true,
        },
      }),
    ]);

    return {
      totalReviews,
      pendingReviews,
      averageRating: avgRating._avg.rating || 0,
    };
  }
}

export const adminReviewRepository = new AdminReviewRepository();


