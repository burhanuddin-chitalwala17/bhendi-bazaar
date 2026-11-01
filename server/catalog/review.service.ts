/**
 * Reviews: what a buyer reads, what a buyer writes, what the platform withdraws.
 *
 * One service over one repository (ADR-0003). The buyer's own create, edit and delete
 * are not admin actions and are not audited; moderation is, through `recordAdminAction`
 * after the committed write (ADR-0021).
 */

import { reviewRepository } from "@server/catalog/review.repository";
import { productsRepository } from "@server/catalog/product.read.repository";
import { profileService } from "@server/identity/profile.service";
import { orderService } from "@server/checkout/order.service";
import {
  loadRatingContext,
  ratingFor,
  summariseOrgRating,
  type OrgRating,
  type ProductRating,
} from "@server/catalog/review-rating";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { deleteObject, isOwnObjectUrl, pathnameFor } from "@server/catalog/object-store";
import { MAX_REVIEW_PHOTOS } from "@server/catalog/media";
import type {
  ReviewListFilters,
  ReviewListResult,
  UpdateReviewInput,
  AdminReview,
  ReviewDto,
  ReviewPageDto,
  ReviewRow,
  EditReviewData,
  ReviewMediaDto,
  ShopReviewDto,
} from "@server/catalog/review.types";
import { REVIEWS_PAGE_SIZE } from "@server/catalog/review.types";
import { DomainError, NotFoundError } from "@server/shared/domain-error";

/** "New" on Home is the last week, not a per-person "seen" mark (own-store onboarding Q24). */
const NEW_REVIEW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface NewReviews {
  count: number;
  /** Set when every new review is on one product, so Home can open it (Q13). */
  productId: string | null;
}

/** What a buyer may submit. Everything else about a review is the server's to decide. */
export interface ReviewSubmission {
  rating: number;
  title?: string | null;
  comment?: string | null;
  /** Object URLs the browser already uploaded, under this author's own folder (R1). */
  photos?: string[];
}

/** Where this reviewer's uploads live, and the only prefix their review may cite. */
const folderFor = (userId: string) => `reviews/${userId}/`;

/**
 * Is this URL an object *this* reviewer uploaded (review-media trd.md D8)?
 *
 * Bucket membership alone is not ownership, and treating it as such was a hole with
 * teeth: every product photograph, every other shopper's review photograph and every
 * org logo is "one of ours". A reviewer could cite a product's own image — hotlinking it
 * onto their review — and then, because an edit deletes the refs it drops, remove that
 * image from the store by editing it back out. The presign route already signs only
 * under `reviews/<caller>/`; this is the same rule enforced on the way back in.
 *
 * Here rather than in the Zod schema because it needs `R2_PUBLIC_BASE_URL`, and that
 * schema is also the form's client-side validation (ADR-0013).
 */
function isOwnReviewPhoto(url: string, userId: string): boolean {
  if (!isOwnObjectUrl(url)) return false;
  const pathname = pathnameFor(url);
  return pathname !== null && pathname.startsWith(folderFor(userId));
}

/**
 * The media rows a submission asks for, having established the author may cite them.
 */
function mediaFrom(input: ReviewSubmission, userId: string): ReviewMediaDto[] {
  const photos = input.photos ?? [];
  if (photos.length > MAX_REVIEW_PHOTOS) {
    throw new DomainError(`A review can carry ${MAX_REVIEW_PHOTOS} photos.`);
  }
  for (const photo of photos) {
    if (!isOwnReviewPhoto(photo, userId)) {
      throw new DomainError("That photo is not one you uploaded.");
    }
  }
  return photos.map((ref) => ({ kind: "IMAGE", ref }));
}

/**
 * Remove the objects an edit dropped, once the replacement has committed.
 *
 * Scoped to the author's own folder a second time. `mediaFrom` has already refused
 * anything else on the way in, but this function *deletes*, and a delete that trusts its
 * caller is one upstream mistake away from removing a product's photograph — which is
 * exactly the shape of the bug this pair of checks closes.
 *
 * Best-effort and never throws: an object left behind is an unreferenced file, which the
 * catalogue already lives with, while a failure that propagated would leave an author
 * unable to edit their own review (review-media trd.md D6).
 */
async function forgetImages(refs: string[], userId: string): Promise<void> {
  await Promise.all(
    refs.map(async (ref) => {
      if (!isOwnReviewPhoto(ref, userId)) return;
      try {
        await deleteObject(ref);
      } catch {
        // The row no longer cites it; the file is now nobody's. Nothing to tell the user.
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
  isMine: row.userId === viewerId,
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
   * What one shop's reviews add up to, over its on-sale products (brand-page R4, D2). Not
   * request-memoised like the product context: one page reads it once.
   */
  async ratingForOrg(orgId: string): Promise<OrgRating> {
    return summariseOrgRating(await reviewRepository.publishedRatingRowsForOrg(orgId));
  }

  /**
   * Home's "new reviews" line (own-store onboarding Q13, Q24): visible reviews from the last 7 days,
   * and the product when they are all on one, so the line can open that product.
   */
  async newForOrg(orgId: string, now: Date = new Date()): Promise<NewReviews> {
    const rows = await reviewRepository.listRecentProductIdsForOrg(orgId, new Date(now.getTime() - NEW_REVIEW_DAYS * DAY_MS));
    const products = new Set(rows.map((row) => row.productId));
    return { count: rows.length, productId: products.size === 1 ? [...products][0] : null };
  }

  /**
   * The newest published reviews across one shop's products, shaped for a stranger
   * (brand-page R1, A3a): the product page's visibility predicate, so a withdrawn or
   * retracted review leaves both surfaces at once — and never a `userId`.
   */
  async recentForOrg(orgId: string, take: number): Promise<ShopReviewDto[]> {
    const rows = await reviewRepository.listPublishedForOrg(orgId, take);
    return rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      authorName: row.userName,
      isVerifiedPurchase: row.isVerified,
      createdAt: row.createdAt.toISOString(),
      product: { name: row.product.name, slug: row.product.slug },
    }));
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
      media: mediaFrom(input, userId),
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
      media: mediaFrom(input, userId),
    };
    // What the edit drops is deleted from the store afterwards, so an author who removes
    // a photo removes the file too (R12) — read before the replacement, deleted after.
    const before = await reviewRepository.imageRefsFor(id);
    const changed = await reviewRepository.updateOwn(id, userId, data);
    if (changed === 0) throw new NotFoundError("Review not found.");
    const kept = new Set(data.media.map((item) => item.ref));
    await forgetImages(before.filter((ref) => !kept.has(ref)), userId);
  }

  /**
   * An author retracting one of their own reviews. Their others are untouched (R9).
   *
   * The buyer's control says *Delete* and what they get is what that word promises: it
   * leaves the product page, the list, the count and the average at once. The row is
   * kept for the platform (ADR-0032), and so are its photographs — nothing is
   * unreferenced, so there is nothing to collect from the store.
   */
  async remove(id: string, userId: string): Promise<void> {
    const deleted = await reviewRepository.softDeleteOwn(id, userId);
    if (deleted === 0) throw new NotFoundError("Review not found.");
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
        action: data.withdrawn ? "REVIEW_WITHDRAWN" : "REVIEW_RESTORED",
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

}

export const reviewService = new ReviewService();
