/**
 * Who the item is offered to next, and whether an offer can still be acted on
 * (winner-offer D1, D2). Pure and Prisma-free like `bidding-window.ts`, so the rules a
 * bidder's money rests on are testable without a database.
 */

import type { BidOfferStatus } from "@prisma/client";

/** 32 random bytes as base64url: 43 characters, safe in a path segment. Here, not beside the minting, so browser code can check a link without pulling in `node:crypto`. */
export const OFFER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** What every new event promises its winner (winner-offer R9/R10). Stored per event, so changing this never rewrites an earlier promise. */
export const CLAIM_WINDOW_HOURS = 12;

/** The statuses that hold the item for one person. The partial unique index in the migration allows one per event. */
export const OPEN_OFFER_STATUSES = ["OFFERED", "ACCEPTED"] as const satisfies readonly BidOfferStatus[];

export function offerExpiry(now: Date, claimWindowHours: number): Date {
  return new Date(now.getTime() + claimWindowHours * 3_600_000);
}

export function isOpenStatus(status: BidOfferStatus): boolean {
  return (OPEN_OFFER_STATUSES as readonly BidOfferStatus[]).includes(status);
}

/**
 * Whether anything may still be started on this offer. Asked at the moment of acting,
 * never from what a page last showed (winner-offer R13). At exactly `expiresAt` it is over.
 */
export function isActionable(
  offer: { status: BidOfferStatus; expiresAt: Date | null },
  now: Date
): boolean {
  return isOpenStatus(offer.status) && offer.expiresAt !== null && now < offer.expiresAt;
}

/** One rung of the ladder, as the chain needs it. */
export interface ChainBid {
  id: string;
  amountPaise: number;
  userId: string | null;
  guestPhone: string | null;
  /** Resolved: the account's email for a user, the one given for a guest. */
  email: string | null;
}

/**
 * The same person across their bids. An account is one person; a guest is known by the
 * phone number every guest bid requires, so a guest who left the email blank on one bid
 * and filled it on another is still one person (winner-offer R2).
 */
export function bidderKey(bid: Pick<ChainBid, "userId" | "guestPhone">): string {
  if (bid.userId) return `user:${bid.userId}`;
  return `guest:${(bid.guestPhone ?? "").replace(/\D/g, "")}`;
}

export type NextStep =
  | { kind: "offer"; bid: ChainBid }
  | { kind: "skip"; bid: ChainBid }
  | { kind: "exhausted" };

/**
 * The next step down the ladder, given the bids offered so far (skips included).
 *
 * Highest first, one step per person: the first bid met for a person is their highest,
 * which is the price they are offered (R3). A person with no email is a `skip`, which the
 * caller records before asking again, so a skip is on the record rather than silent (R5).
 */
export function nextStep(ladder: readonly ChainBid[], alreadyOffered: readonly ChainBid[]): NextStep {
  const done = new Set(alreadyOffered.map(bidderKey));
  const byAmount = [...ladder].sort((a, b) => b.amountPaise - a.amountPaise);
  for (const bid of byAmount) {
    if (done.has(bidderKey(bid))) continue;
    return bid.email ? { kind: "offer", bid } : { kind: "skip", bid };
  }
  return { kind: "exhausted" };
}
