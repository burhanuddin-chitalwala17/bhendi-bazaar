import type { BrandProof } from "@server/catalog/storefront.types";

/**
 * The floors under a brand page's proof (brand-page R4, D3): a statistic too small to be
 * convincing is left out, not shown small. Declared once, beside the DTO, so the strip, the
 * "what buyers say" section and the org's own panel cannot disagree on when a number shows.
 */
export const PROOF_FLOORS = {
  /** A rating — and the quoted reviews, which share its floor — from this many published reviews. */
  minReviewsForRating: 3,
  /** An orders figure from this many paid orders. */
  minOrdersForCount: 10,
} as const;

/**
 * How many recent reviews the page quotes (R1: "two or three"). The rating's floor, so a shop
 * that clears it always has enough to quote.
 */
export const BUYERS_SAY_COUNT = PROOF_FLOORS.minReviewsForRating;

export interface ProofInput {
  /** Voice-weighted across the org's on-sale products; null with no published review. */
  ratingAverage: number | null;
  ratingCount: number;
  paidOrders: number;
}

/** One decimal, as every other surface prints a rating. */
const oneDecimal = (value: number) => Math.round(value * 10) / 10;

/** The strip's figures, or null when nothing cleared a floor — a hero with no proof closes up. */
export function proofFrom(input: ProofInput): BrandProof | null {
  const rating =
    input.ratingAverage !== null && input.ratingCount >= PROOF_FLOORS.minReviewsForRating
      ? { average: oneDecimal(input.ratingAverage), count: input.ratingCount }
      : null;
  const ordersFulfilled =
    input.paidOrders >= PROOF_FLOORS.minOrdersForCount ? input.paidOrders : null;
  return rating || ordersFulfilled !== null ? { rating, ordersFulfilled } : null;
}

/**
 * The reviews the page quotes, or null under the floor. Judged on the org's published count
 * rather than the list's length, so the rule is the rating's rule and not "however many came back".
 */
export function buyersSayFrom<T>(recent: readonly T[], publishedCount: number): T[] | null {
  return publishedCount >= PROOF_FLOORS.minReviewsForRating && recent.length > 0
    ? recent.slice(0, BUYERS_SAY_COUNT)
    : null;
}
