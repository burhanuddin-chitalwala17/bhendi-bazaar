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
import { AVAILABLE } from "@server/catalog/product.visibility";
import type { RatingRow } from "@server/catalog/review-rating";
import type {
  AdminReview,
  ReviewListFilters,
  UpdateReviewInput,
  CreateReviewData,
  EditReviewData,
  ReviewRow,
  ShopReviewRow,
} from "@server/catalog/review.types";

/**
 * The one predicate for "a buyer may see this review" (R6, ADR-0032).
 *
 * Exported and spread, never re-spelled: reviews are now hidden for two unrelated
 * reasons — the platform withdrew it, or its author retracted it — and a read path that
 * remembers one and forgets the other shows content that was taken down. Same seam the
 * catalogue uses for `ON_SALE`, and `tests/unit/review-visibility.test.ts` census-checks
 * the call sites.
 */
export const VISIBLE_REVIEW_WHERE = {
  withdrawnAt: null,
  deletedAt: null,
} as const;

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

/** One admin row, shaped once for the three reads that answer with it. */
type AdminReviewRecord = Prisma.ReviewGetPayload<{
  include: { product: { select: { name: true } }; media: typeof MEDIA_SELECT };
}>;

const toAdminReview = (review: AdminReviewRecord): AdminReview => ({
  id: review.id,
  productId: review.productId,
  productName: review.product.name,
  userId: review.userId,
  userName: review.userName,
  rating: review.rating,
  title: review.title,
  comment: review.comment,
  isVerified: review.isVerified,
  withdrawnAt: review.withdrawnAt,
  deletedAt: review.deletedAt,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  media: review.media,
});

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
      where: { productId: { in: [...productIds] }, ...VISIBLE_REVIEW_WHERE },
      select: { id: true, productId: true, userId: true, rating: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** One product's visible reviews, newest first — the list a buyer scrolls (R1, R3). */
  async listPublished(
    productId: string,
    skip: number,
    take: number
  ): Promise<{ rows: ReviewRow[]; total: number }> {
    const where = { productId, ...VISIBLE_REVIEW_WHERE };
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

  /**
   * The rating projection for every on-sale product of one org, in one query (brand-page D2).
   * `AVAILABLE` because an archived product has no page: a review nobody can reach is not
   * counted on the shop's sign either (A3a).
   */
  async publishedRatingRowsForOrg(orgId: string): Promise<RatingRow[]> {
    return prisma.review.findMany({
      where: { product: { orgId, ...AVAILABLE }, ...VISIBLE_REVIEW_WHERE },
      select: { id: true, productId: true, userId: true, rating: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * The newest visible reviews across one org's on-sale products, with the product each is
   * about (brand-page R1). Same predicate as the product page's list, so the two agree (A3a).
   */
  async listPublishedForOrg(orgId: string, take: number): Promise<ShopReviewRow[]> {
    return prisma.review.findMany({
      where: { product: { orgId, ...AVAILABLE }, ...VISIBLE_REVIEW_WHERE },
      select: {
        id: true,
        userName: true,
        rating: true,
        comment: true,
        isVerified: true,
        createdAt: true,
        product: { select: { name: true, slug: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      relationLoadStrategy: "join",
    });
  }

  /**
   * A buyer's new review. `isVerified` is decided by the service from order history, and
   * `withdrawnAt`/`deletedAt` are simply not written here, so none of the three is
   * reachable from a request body (R4, R15, Invariant 4). A new review is live because
   * both state columns default to NULL, which is publish-on-write with no flag to set.
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
        // `deletedAt: null` is part of the guard, not a filter: a retracted review is
        // not an editable one, and without it an author could revive their own words
        // by saving over them.
        where: { id, userId, deletedAt: null },
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

  /**
   * The author's own retraction (R9, ADR-0032).
   *
   * A timestamp, not a `DELETE`: the review leaves every buyer-facing surface and the
   * average immediately, and the platform keeps what was said and who said it. Scoped
   * by `userId` in the statement like the edit above, and idempotent through
   * `deletedAt: null` — retracting twice answers zero rather than moving the clock.
   */
  async softDeleteOwn(id: string, userId: string): Promise<number> {
    const { count } = await prisma.review.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return count;
  }

  /**
   * Get paginated list of reviews with filters
   */
  async getReviews(filters: ReviewListFilters) {
    const {
      search,
      productId,
      state,
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

    // Three states from two nullable timestamps. Retraction wins over withdrawal when
    // both happened, because the author's own act is the one to report back to them.
    if (state === "published") {
      where.withdrawnAt = null;
      where.deletedAt = null;
    } else if (state === "withdrawn") {
      where.withdrawnAt = { not: null };
      where.deletedAt = null;
    } else if (state === "deleted") {
      where.deletedAt = { not: null };
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

    return { reviews: reviews.map(toAdminReview), total };
  }

  /**
   * Reviews on one org's products. Read-only: moderation stays with the platform (R17).
   *
   * Withdrawn reviews are included, because an org should see what was said about
   * its piece and that the platform acted on it. **Retracted ones are not**: an author
   * taking their words back is not a moderation outcome, and showing them to the org
   * anyway would defeat the retraction (ADR-0032).
   *
   * `userName` is read from the review, never joined from `user` — the frozen name is
   * the one R11 promises, and joining would re-render every published review under
   * whatever the account is called today.
   */
  async getReviewsForOrg(orgId: string, page = 1, limit = 20) {
    const where = { product: { orgId }, deletedAt: null };
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          withdrawnAt: true,
          isVerified: true,
          createdAt: true,
          userName: true,
          product: { select: { id: true, name: true, slug: true, thumbnail: true } },
          // An org seeing "3 reviews" with no sight of the photographs posted against
          // its own product cannot tell what a buyer is actually looking at.
          media: MEDIA_SELECT,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        // Review + product in one JOIN, matching getReviews/getReviewById.
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

    return review ? toAdminReview(review) : null;
  }

  /**
   * Update review
   */
  /**
   * Withdraw a review, or restore one (R15, R16).
   *
   * The only state moderation may write. An author's retraction is a different column
   * written by a different path, so restoring a withdrawal cannot un-retract anything.
   */
  async updateReview(
    id: string,
    data: UpdateReviewInput
  ): Promise<AdminReview | null> {
    const review = await prisma.review.update({
      where: { id },
      data: { withdrawnAt: data.withdrawn ? new Date() : null },
      include: { product: { select: { name: true } }, media: MEDIA_SELECT },
    });
    return toAdminReview(review);
  }
}

export const reviewRepository = new ReviewRepository();
