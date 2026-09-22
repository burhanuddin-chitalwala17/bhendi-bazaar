/**
 * The one repository for `Review` — storefront reads, buyer writes, admin moderation.
 *
 * One aggregate, one repository (Invariant 5, ADR-0003): reviews are read by the
 * product page, the admin console and the org portal, and a second module writing them
 * is how the same row comes to have two shapes. The `admin*` methods are additional
 * reads on the same aggregate, not an admin domain — the split `admin.order.*` uses.
 */

import { prisma } from "@server/shared/prisma";
import { Prisma } from "@prisma/client";
import type { RatingRow } from "@server/catalog/review-rating";
import type {
  AdminReview,
  ReviewListFilters,
  UpdateReviewInput,
  ReviewStats,
  CreateReviewData,
  EditReviewData,
  ReviewRow,
} from "@server/catalog/review.types";

/** Published only. Withdrawing a review stops it counting the moment it happens (R6). */
const PUBLISHED = { isApproved: true } as const;

/**
 * A review's own media, in the order it was submitted (review-media D9).
 *
 * Ordered explicitly: under `relationLoadStrategy: "join"` an unordered nested list comes
 * back arbitrarily, and these are displayed.
 */
const MEDIA_SELECT = {
  select: { kind: true, ref: true },
  orderBy: { position: "asc" },
} as const;

export class ReviewRepository {
  /**
   * The projection the rating arithmetic reduces (review-rating.ts, trd.md D4).
   *
   * Four columns for the products on one page, newest first. `id` is selected because
   * it breaks a same-millisecond tie deterministically, not for display.
   */
  async publishedRatingRows(productIds: readonly string[]): Promise<RatingRow[]> {
    if (productIds.length === 0) return [];
    return prisma.review.findMany({
      where: { productId: { in: [...productIds] }, ...PUBLISHED },
      select: { id: true, productId: true, userId: true, rating: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** One product's published reviews, newest first — the list a buyer scrolls (R1, R3). */
  async listPublished(
    productId: string,
    skip: number,
    take: number
  ): Promise<{ rows: ReviewRow[]; total: number }> {
    const where = { productId, ...PUBLISHED };
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          userId: true,
          userName: true,
          rating: true,
          title: true,
          comment: true,
          isVerified: true,
          createdAt: true,
          media: MEDIA_SELECT,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      prisma.review.count({ where }),
    ]);
    return { rows, total };
  }

  /** Full row, for an ownership check before an edit or a delete (R9). */
  async findById(id: string) {
    return prisma.review.findUnique({
      where: { id },
      select: { id: true, productId: true, userId: true, isApproved: true },
    });
  }

  /**
   * A buyer's new review. `isVerified` is decided by the service from order history and
   * `isApproved` is left to its default, so neither is reachable from a request body
   * (R4, R15, Invariant 4).
   */
  async create(data: CreateReviewData): Promise<ReviewRow> {
    return prisma.review.create({
      data: {
        productId: data.productId,
        userId: data.userId,
        userName: data.userName,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        isVerified: data.isVerified,
        media: {
          create: data.media.map((item, position) => ({
            kind: item.kind,
            ref: item.ref,
            position,
          })),
        },
      },
      select: {
        id: true,
        userId: true,
        userName: true,
        rating: true,
        title: true,
        comment: true,
        isVerified: true,
        createdAt: true,
        media: MEDIA_SELECT,
      },
    });
  }

  /**
   * The author's own edit, scoped by `userId` in the statement rather than checked
   * first: a where-clause the caller cannot satisfy is a guard, a prior read is a race.
   * `count === 0` means it was not theirs (or no longer exists).
   */
  async updateOwn(id: string, userId: string, data: EditReviewData): Promise<number> {
    // One transaction, because the media replacement must not survive an update that
    // turned out not to be theirs — and `updateMany`'s count is the ownership answer.
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.review.updateMany({
        where: { id, userId },
        data: { rating: data.rating, title: data.title, comment: data.comment },
      });
      if (count === 0) return 0;

      // Replaced wholesale (EditReviewData): the form submits the set the review should
      // now carry, so there is nothing to diff.
      await tx.reviewMedia.deleteMany({ where: { reviewId: id } });
      if (data.media.length > 0) {
        await tx.reviewMedia.createMany({
          data: data.media.map((item, position) => ({
            reviewId: id,
            kind: item.kind,
            ref: item.ref,
            position,
          })),
        });
      }
      return count;
    });
  }

  /**
   * The object URLs a review holds, for the caller to delete from the store after the
   * rows are gone (review-media trd.md D6). A cascade cannot reach R2.
   */
  async imageRefsFor(id: string): Promise<string[]> {
    const rows = await prisma.reviewMedia.findMany({
      where: { reviewId: id, kind: "IMAGE" },
      select: { ref: true },
    });
    return rows.map((row) => row.ref);
  }

  /** The author's own delete, scoped the same way (R9). */
  async deleteOwn(id: string, userId: string): Promise<number> {
    const { count } = await prisma.review.deleteMany({ where: { id, userId } });
    return count;
  }

  /** How many reviews this shopper has written about this product — for the form's copy. */
  async countByAuthor(productId: string, userId: string): Promise<number> {
    return prisma.review.count({ where: { productId, userId } });
  }

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
        relationLoadStrategy: "join",
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
          media: MEDIA_SELECT,
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
      media: review.media,
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
        // Review + product + user in one JOIN, matching getReviews/getReviewById below.
        relationLoadStrategy: "join",
      }),
      prisma.review.count({ where }),
    ]);
    return { reviews, total, page, limit };
  }

  async getReviewById(id: string): Promise<AdminReview | null> {
    const review = await prisma.review.findUnique({
      relationLoadStrategy: "join",
      where: { id },
      include: {
        product: {
          select: {
            name: true,
          },
        },
        media: MEDIA_SELECT,
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
      media: review.media,
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
        media: MEDIA_SELECT,
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
      media: review.media,
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
    const [totalReviews, withdrawnReviews, avgRating] = await Promise.all([
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
      withdrawnReviews,
      averageRating: avgRating._avg.rating || 0,
    };
  }
}

export const reviewRepository = new ReviewRepository();
