/**
 * What a product's reviews add up to (product-reviews R6, R6a, R10; trd.md D3–D6).
 *
 * The numbers are derived, never stored: `Product.rating` and `Product.reviewsCount`
 * were columns nothing wrote, so every tile advertised 0.0 however many reviews the
 * product held. One resolver instead, called by every surface that shows a rating —
 * ADR-0018's rule for prices, applied to a second number.
 *
 * `loadRatingContext` is one query for a whole page of products, memoised per request
 * as `loadPriceContext` and `loadBiddingLockContext` are. `summariseRatings` is the
 * arithmetic and is pure, because R10 is the part that has to be right: all of a
 * shopper's reviews are shown and counted, but the average counts only their most
 * recent, so repeat reviewing cannot set a rating.
 */

import { cache } from "react";
import { reviewRepository } from "@server/catalog/review.repository";
import { cachedRead, CACHED_READ_EXPIRY } from "@server/shared/read-cache";
import {
  STAR_VALUES,
  type ProductRating,
  type StarValue,
} from "@server/catalog/review.types";

// Re-exported so a server caller can take the arithmetic and the shapes from one import.
// The declarations live in review.types.ts, which a client component may import; this
// module reaches the repository and so must never end up in a browser bundle.
export { STAR_VALUES };
export type { ProductRating, StarValue };

/** One published review, reduced to what the arithmetic needs (trd.md D4). */
export interface RatingRow {
  id: string;
  productId: string;
  /** Null for a review whose account is gone; each such row is its own voice (D6). */
  userId: string | null;
  rating: number;
  createdAt: Date;
}

export interface RatingContext {
  byProduct: ReadonlyMap<string, ProductRating>;
}

const emptyHistogram = (): Record<StarValue, number> => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

export const NO_RATING: ProductRating = {
  average: 0,
  count: 0,
  histogram: emptyHistogram(),
};

export const EMPTY_RATING_CONTEXT: RatingContext = { byProduct: new Map() };

/**
 * Later of two reviews by the same shopper. `createdAt` decides it; the id breaks a
 * tie, so two reviews saved in the same millisecond resolve the same way on every
 * render rather than by whichever row the database happened to return first.
 */
const isLater = (row: RatingRow, than: RatingRow): boolean =>
  row.createdAt.getTime() !== than.createdAt.getTime()
    ? row.createdAt.getTime() > than.createdAt.getTime()
    : row.id > than.id;

/** Whose review this is, for R10. A review with no account cannot be grouped with anything, so it keys on itself. */
const voiceOf = (row: RatingRow): string => row.userId ?? `anonymous:${row.id}`;

/**
 * The three numbers, from one pass over the rows (trd.md D4).
 *
 * Together rather than separately so they cannot disagree with each other or with the
 * list below them, which is what R6 asks for. Order of input does not matter.
 */
export function summariseRatings(rows: readonly RatingRow[]): Map<string, ProductRating> {
  const counts = new Map<string, number>();
  const histograms = new Map<string, Record<StarValue, number>>();
  // productId -> voice key -> that voice's most recent review.
  const voices = new Map<string, Map<string, RatingRow>>();

  for (const row of rows) {
    const star = Math.min(5, Math.max(1, Math.round(row.rating))) as StarValue;
    counts.set(row.productId, (counts.get(row.productId) ?? 0) + 1);

    let histogram = histograms.get(row.productId);
    if (!histogram) histograms.set(row.productId, (histogram = emptyHistogram()));
    histogram[star] += 1;

    let perVoice = voices.get(row.productId);
    if (!perVoice) voices.set(row.productId, (perVoice = new Map()));
    const voice = voiceOf(row);
    const held = perVoice.get(voice);
    if (!held || isLater(row, held)) perVoice.set(voice, row);
  }

  const summaries = new Map<string, ProductRating>();
  for (const [productId, count] of counts) {
    const latest = [...(voices.get(productId)?.values() ?? [])];
    const total = latest.reduce((sum, row) => sum + row.rating, 0);
    summaries.set(productId, {
      average: latest.length === 0 ? 0 : total / latest.length,
      count,
      histogram: histograms.get(productId) ?? emptyHistogram(),
    });
  }
  return summaries;
}

/** What a shop's reviews add up to (brand-page R4): the same two numbers, over every product it sells. */
export interface OrgRating {
  /** Null with nothing published — a zero here would read as a rating. */
  average: number | null;
  count: number;
}

/**
 * The shop-level figures, under the same R10 rule per product: a shopper who reviewed one piece
 * ten times is one voice on it, and a shopper who reviewed three pieces is three. `count` is
 * every published review, matching what the product pages list.
 */
export function summariseOrgRating(rows: readonly RatingRow[]): OrgRating {
  const latest = new Map<string, RatingRow>();
  for (const row of rows) {
    const key = `${row.productId}|${voiceOf(row)}`;
    const held = latest.get(key);
    if (!held || isLater(row, held)) latest.set(key, row);
  }
  const voices = [...latest.values()];
  return {
    average:
      voices.length === 0
        ? null
        : voices.reduce((sum, row) => sum + row.rating, 0) / voices.length,
    count: rows.length,
  };
}

/**
 * Ratings for the products on this page, in one query.
 *
 * Memoised on a sorted key rather than the array, since React's `cache` compares
 * arguments by identity and two call sites never share an array instance. A page that
 * lists twelve products and then asks for one of them again pays for two queries at
 * worst, not thirteen.
 */
export async function loadRatingContext(productIds: readonly string[], { shared = false }: { shared?: boolean } = {}): Promise<RatingContext> {
  const unique = [...new Set(productIds)].sort();
  if (unique.length === 0) return EMPTY_RATING_CONTEXT;
  return (shared ? loadShared : loadByKey)(unique.join(","));
}

export const RATING_TABLES = ["Review"] as const;

const loadByKey = cache(async (key: string): Promise<RatingContext> => {
  const rows = await reviewRepository.publishedRatingRows(key.split(","));
  return { byProduct: summariseRatings(rows) };
});

// Shared across requests too (ADR-0065), for a set of products that is itself a cached page: an
// arbitrary set (a search's results) would add an entry per query. A review written clears it.
const loadShared = cache(async (key: string): Promise<RatingContext> => {
  const rows = await cachedRead("rating-rows", [key], { tables: RATING_TABLES, seconds: CACHED_READ_EXPIRY.slow }, () =>
    reviewRepository.publishedRatingRows(key.split(",")),
  );
  return { byProduct: summariseRatings(rows) };
});

/** This product's numbers, or zeroes when nothing is published. */
export function ratingFor(context: RatingContext, productId: string): ProductRating {
  return context.byProduct.get(productId) ?? NO_RATING;
}
