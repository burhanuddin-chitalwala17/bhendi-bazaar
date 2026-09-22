/**
 * Reviews: what a buyer reads, what a buyer writes, what the platform withdraws.
 *
 * One service over one repository (ADR-0003). The buyer's own create, edit and delete
 * are not admin actions and are not audited; moderation is, through `recordAdminAction`
 * after the committed write (ADR-0021).
 */

import { reviewRepository } from "@server/catalog/review.repository";
import { productsRepository } from "@server/catalog/product.repository";
import { profileService } from "@server/identity/profile.service";
import { orderService } from "@server/checkout/order.service";
import {
  loadRatingContext,
  ratingFor,
  type ProductRating,
} from "@server/catalog/review-rating";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { deleteObject, isOwnObjectUrl } from "@server/catalog/object-store";
import { MAX_REVIEW_PHOTOS } from "@server/catalog/media";
import type {
  ReviewListFilters,
  ReviewListResult,
  UpdateReviewInput,
  ReviewStats,
  AdminReview,
  ReviewDto,
  ReviewPageDto,
  ReviewRow,
  EditReviewData,
  ReviewMediaDto,
} from "@server/catalog/review.types";
import { REVIEWS_PAGE_SIZE } from "@server/catalog/review.types";
import { DomainError, NotFoundError } from "@server/shared/domain-error";

/** What a buyer may submit. Everything else about a review is the server's to decide. */
export interface ReviewSubmission {
  rating: number;
  title?: string | null;
  comment?: string | null;
  /** Object URLs the browser already uploaded (review-media R1). */
  photos?: string[];
  /** A bare video id, already parsed out of whatever was pasted (ADR-0017). */
  video?: string | null;
}

/**
 * The media rows a submission asks for (review-media trd.md D8).
 *
 * The ownership test is here rather than in the Zod schema because it needs
 * `R2_PUBLIC_BASE_URL`, and that schema is also the form's client-side validation. A
 * photograph on somebody else's host would make the product page a hotlink to something
 * we can neither moderate nor delete.
 */
function mediaFrom(input: ReviewSubmission): ReviewMediaDto[] {
  const photos = input.photos ?? [];
  if (photos.length > MAX_REVIEW_PHOTOS) {
    throw new DomainError(`A review can carry ${MAX_REVIEW_PHOTOS} photos.`);
  }
  for (const photo of photos) {
    if (!isOwnObjectUrl(photo)) {
      throw new DomainError("That photo is not one of ours.");
    }
  }
  const media: ReviewMediaDto[] = photos.map((ref) => ({ kind: "IMAGE", ref }));
  if (input.video) media.push({ kind: "YOUTUBE", ref: input.video });
  return media;
}

/**
 * Remove the objects a deleted review held, after its rows are gone.
 *
 * Best-effort and never throws: an object left behind is an unreferenced file, which the
 * catalogue already lives with, while a failure that propagated would leave an author
 * unable to delete their own review (review-media trd.md D6).
 */
async function forgetImages(refs: string[]): Promise<void> {
  await Promise.all(
    refs.map(async (ref) => {
      try {
        await deleteObject(ref);
      } catch {
        // The row is already gone; the file is now nobody's. Nothing to tell the user.
      }
    })
  );
}

const toDto = (row: ReviewRow, viewerId: string | null): ReviewDto => ({
  id: row.id,
  rating: row.rating,
  title: row.title,
  comment: row.comment,
  authorName: row.userName,
  isVerifiedPurchase: row.isVerified,
  createdAt: row.createdAt.toISOString(),
  // An anonymous row belongs to nobody, so `null === null` must not make it mine.
  isMine: viewerId !== null && row.userId === viewerId,
  media: row.media,
});

export class ReviewService {
  /**
   * One page of a product's reviews and the summary above them (R1–R3).
   *
   * The summary comes from the same request-memoised context the tiles read, so the
   * number beside the stars on this page and the number on its listing tile are the
   * same computation, not two that agree by luck (R6).
   */
  async getPage(
    productId: string,
    page: number,
    viewerId: string | null
  ): Promise<ReviewPageDto> {
    const take = REVIEWS_PAGE_SIZE;
    const skip = (Math.max(1, page) - 1) * take;
    const [{ rows, total }, ratings] = await Promise.all([
      reviewRepository.listPublished(productId, skip, take),
      loadRatingContext([productId]),
    ]);
    return {
      reviews: rows.map((row) => toDto(row, viewerId)),
      summary: ratingFor(ratings, productId),
      total,
      hasMore: skip + rows.length < total,
    };
  }

  /** This product's numbers on their own, for a surface that shows no list. */
  async getSummary(productId: string): Promise<ProductRating> {
    return ratingFor(await loadRatingContext([productId]), productId);
  }

  /**
   * A signed-in shopper's new review (R7, R8).
   *
   * Three things the payload does not get to decide: the display name comes from the
   * account and is frozen onto the row (R11), the **Verified purchase** mark comes from
   * order history (R4), and publication is the column default (R15).
   */
  async create(
    userId: string,
    productId: string,
    input: ReviewSubmission
  ): Promise<ReviewDto> {
    if (!(await productsRepository.isOnSale(productId))) {
      throw new NotFoundError("This product is no longer available to review.");
    }

    const [{ user }, purchased] = await Promise.all([
      profileService.getProfile(userId),
      orderService.hasPurchased(userId, [productId]),
    ]);

    const row = await reviewRepository.create({
      productId,
      userId,
      // Re-read from the account rather than taken from the session claim, the rule
      // ADR-0021 sets for an admin id. A blank account name still has to render.
      userName: user.name?.trim() || "A Bhendi Bazaar shopper",
      rating: input.rating,
      title: input.title?.trim() || null,
      comment: input.comment?.trim() || null,
      isVerified: purchased.has(productId),
      media: mediaFrom(input),
    });

    return toDto(row, userId);
  }

  /**
   * An author editing one of their own reviews (R9).
   *
   * Scoped by `userId` inside the statement: a review that is not theirs updates zero
   * rows, which is the same answer as one that does not exist — deliberately, since
   * telling a stranger which review ids exist is not this endpoint's job.
   */
  async edit(id: string, userId: string, input: ReviewSubmission): Promise<void> {
    const data: EditReviewData = {
      rating: input.rating,
      title: input.title?.trim() || null,
      comment: input.comment?.trim() || null,
      media: mediaFrom(input),
    };
    // What the edit drops is deleted from the store afterwards, so an author who removes
    // a photo removes the file too (R12) — read before the replacement, deleted after.
    const before = await reviewRepository.imageRefsFor(id);
    const changed = await reviewRepository.updateOwn(id, userId, data);
    if (changed === 0) throw new NotFoundError("Review not found.");
    const kept = new Set(data.media.map((item) => item.ref));
    await forgetImages(before.filter((ref) => !kept.has(ref)));
  }

  /** An author deleting one of their own reviews. Their others are untouched (R9). */
  async remove(id: string, userId: string): Promise<void> {
    // Collected before the delete, because the cascade takes the rows with it.
    const refs = await reviewRepository.imageRefsFor(id);
    const deleted = await reviewRepository.deleteOwn(id, userId);
    if (deleted === 0) throw new NotFoundError("Review not found.");
    await forgetImages(refs);
  }

  /**
   * Get paginated list of reviews
   */
  async getReviews(filters: ReviewListFilters): Promise<ReviewListResult> {
    const { reviews, total } = await reviewRepository.getReviews(filters);

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
    return await reviewRepository.getReviewById(id);
  }

  /**
   * Withdraw a review, or restore one (R15, R16).
   *
   * Withdrawing is not deleting: the row stays readable in the admin portal, because
   * why it was withdrawn usually matters later.
   */
  async updateReview(
    id: string,
    adminId: string,
    data: UpdateReviewInput
  ): Promise<AdminReview | null> {
    const review = await reviewRepository.updateReview(id, data);

    if (review) {
      await recordAdminAction({
        adminId,
        action: data.isApproved ? "REVIEW_RESTORED" : "REVIEW_WITHDRAWN",
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
    const review = await reviewRepository.getReviewById(id);

    if (!review) {
      throw new NotFoundError("Review not found");
    }

    const refs = await reviewRepository.imageRefsFor(id);
    await reviewRepository.deleteReview(id);
    await forgetImages(refs);

    await recordAdminAction({
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
    return await reviewRepository.getReviewStats();
  }
}

export const reviewService = new ReviewService();
