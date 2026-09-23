/**
 * Review types — storefront, buyer writes, and admin moderation.
 *
 * One declaration each, imported by the repository, the service, the Zod schema and the
 * components (the `ProductFlag` drift CONTRACTS.md records is why).
 */

import type { MediaKind } from "@server/catalog/media";

/**
 * The five stars, and the shape a rating takes.
 *
 * Here rather than beside the arithmetic in `review-rating.ts` because the components
 * need them: that module reaches the repository, and a client component importing a
 * *value* from it would pull Prisma into the browser bundle. This file's own imports are
 * type-only, so it erases at build.
 */
export const STAR_VALUES = [1, 2, 3, 4, 5] as const;
export type StarValue = (typeof STAR_VALUES)[number];

export interface ProductRating {
  /** Voice-weighted: one shopper's most recent review, however many they wrote (R10). */
  average: number;
  /** Every published review, matching the list the buyer scrolls (D4a). */
  count: number;
  /** Reviews per star, so the bars sum to `count` rather than to the voices. */
  histogram: Record<StarValue, number>;
}

/**
 * One photograph or video on a review (review-media R1, R5).
 *
 * `ref` is an object URL in our own bucket for `IMAGE` and a bare video id for `YOUTUBE`
 * — the same two meanings `ProductMediaDto.ref` carries, so one renderer shape serves
 * both. Reuses `MediaKind` rather than declaring a second closed set (trd.md D2).
 */
export interface ReviewMediaDto {
  kind: MediaKind;
  ref: string;
}

/** A published review as the database holds it, before it is shaped for a buyer. */
export interface ReviewRow {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerified: boolean;
  createdAt: Date;
  media: ReviewMediaDto[];
}

/**
 * One review on the wire.
 *
 * No `userId`: a buyer-facing payload has no reason to carry who wrote a review beyond
 * the display name the review already froze (R11). `isMine` is resolved server-side
 * from the session, so the client knows which reviews it may edit without being handed
 * anyone's id (R9).
 */
export interface ReviewDto {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  authorName: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  isMine: boolean;
  /** The reviewer's own photographs, and at most one video (review-media R1, R6). */
  media: ReviewMediaDto[];
}

/** The summary above the list: average, count, and the per-star bars (R2). */
export type ReviewSummaryDto = ProductRating;

/**
 * How many reviews a page of the list holds (R3).
 *
 * Small because the list starts partial on a phone and extends in place: five reviews
 * is about a screen, and the control to read more has to be reachable without a scroll
 * through everything already loaded.
 */
export const REVIEWS_PAGE_SIZE = 5;

/** One page of a product's reviews, plus what the summary needs (R2, R3). */
export interface ReviewPageDto {
  reviews: ReviewDto[];
  summary: ReviewSummaryDto;
  total: number;
  /** Whether a further page exists, so the control can say so without a second call. */
  hasMore: boolean;
}

/** What the service hands the repository. `isVerified` is never from a request body (R4). */
export interface CreateReviewData {
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerified: boolean;
  media: ReviewMediaDto[];
}

/**
 * What an author may change about their own review (R9).
 *
 * `media` is the whole set, not a patch: the form submits what the review should now
 * carry, and the repository replaces the rows. A partial media edit would need ids on the
 * wire and an ownership check per row, to express something no control offers.
 */
export interface EditReviewData {
  rating: number;
  title: string | null;
  comment: string | null;
  media: ReviewMediaDto[];
}

export interface AdminReview {
  id: string;
  productId: string;
  productName?: string;
  userId: string;
  userName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerified: boolean;
  /** Set when the platform took it down (R15); null is published. */
  withdrawnAt: Date | null;
  /** Set when the author retracted it (R9). A different act, so a different column. */
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /**
   * What the review shows, so the queue can judge it (review-media R13).
   *
   * A moderation list that shows only text cannot moderate pictures, and opening each
   * review in turn is the friction that means nobody looks.
   */
  media: ReviewMediaDto[];
}

/** What the moderation queue is looking at. Every review is exactly one of these. */
export type ReviewState = "published" | "withdrawn" | "deleted";

export const REVIEW_STATES: readonly ReviewState[] = [
  "published",
  "withdrawn",
  "deleted",
] as const;

export interface ReviewListFilters {
  search?: string; // Search by product name, user name, comment
  productId?: string;
  /** Absent means every state, including what authors retracted (R16, ADR-0032). */
  state?: ReviewState;
  isVerified?: boolean;
  minRating?: number;
  maxRating?: number;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "rating";
  sortOrder?: "asc" | "desc";
}

export interface ReviewListResult {
  reviews: AdminReview[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Withdrawal is the only thing moderation may change (R15, R16).
 *
 * `isVerified` was here and is deliberately gone: the store awards the badge from its
 * own order history, so a reviewer cannot claim it and an admin cannot grant it (R4).
 * An author's own retraction is not reachable from here either — different actor,
 * different column (ADR-0032).
 */
export interface UpdateReviewInput {
  withdrawn: boolean;
}
