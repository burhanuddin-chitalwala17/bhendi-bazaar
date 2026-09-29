/**
 * Whether a product may be bought right now (bidding D8, spec R29–R33).
 *
 * Two layers of different strengths: `loadBiddingLockContext` is display — one small
 * indexed query for the whole locked set, memoised per request as `loadPriceContext`
 * is, so a listing asks once rather than once per product. `assertNotUnderBidding` is
 * enforcement and the only authoritative one, because a per-request set is stale the
 * instant it is built. Removing a button is not a control (spec R31).
 *
 * Nothing here writes to `Product`: suspension is a fact about an event, asked when it
 * matters, so no product row carries a mark that has to be cleaned up (spec R32).
 */

import { cache } from "react";
import { biddingRepository, type BiddingDb } from "@server/bidding/bidding.repository";
import { ConflictError } from "@server/shared/domain-error";
import type { OfferClaim } from "@server/bidding/bidding.types";

export interface BiddingLockContext {
  /** `productId -> the event's public slug`, so a caller can link to it (spec R30). */
  locked: ReadonlyMap<string, string>;
  now: Date;
}

export const EMPTY_BIDDING_LOCK_CONTEXT: BiddingLockContext = {
  locked: new Map(),
  now: new Date(0),
};

export const loadBiddingLockContext = cache(async (): Promise<BiddingLockContext> => {
  const now = new Date();
  const locks = await biddingRepository.lockedProducts(now);
  return {
    locked: new Map(locks.map((lock) => [lock.productId, lock.slug])),
    now,
  };
});

/** The event holding this product out of sale, or null. */
export function biddingLockFor(
  context: BiddingLockContext,
  productId: string
): string | null {
  return context.locked.get(productId) ?? null;
}

/**
 * Which of these products are up for bidding right now. Authoritative.
 *
 * `claim` is the one way through: the auction whose accepted offer this order is buying
 * does not hold its own winner out (ADR-0041 D3). It releases that event only, never the
 * product, so a second event or any other buyer is still refused.
 */
export async function lockedAmong(
  productIds: string[],
  now: Date,
  db?: BiddingDb,
  claim?: Pick<OfferClaim, "eventId">
): Promise<Set<string>> {
  const locked = await biddingRepository.lockedAmong(productIds, now, db);
  return new Set(
    locked.filter((lock) => lock.eventId !== claim?.eventId).map((lock) => lock.productId)
  );
}

/**
 * Refuse a purchase of anything currently up for bidding.
 *
 * Throws rather than returning a flag: every caller's correct response is to abandon
 * the write, and inside a transaction that is what a throw does.
 */
export async function assertNotUnderBidding(
  productIds: string[],
  now: Date,
  db?: BiddingDb,
  claim?: Pick<OfferClaim, "eventId">
): Promise<void> {
  const locked = await lockedAmong(productIds, now, db, claim);
  if (locked.size === 0) return;
  throw new ConflictError(
    locked.size === 1
      ? "This item is up for bidding and cannot be bought directly right now."
      : `${locked.size} items in your order are up for bidding and cannot be bought directly right now.`
  );
}
