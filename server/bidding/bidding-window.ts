/**
 * Phase derivation and bid arithmetic — pure, and deliberately free of Prisma so the
 * rules can be tested and reused without a database (bidding D1/D3).
 *
 * The stored status records only what the clock cannot decide. Everything about
 * *when* an event is comes from its two timestamps against a clock passed in, which
 * is what lets this feature run with no scheduled job: a read can never be stale
 * because nothing was ever cached.
 */

import type { BiddingStatus } from "@prisma/client";

export type BiddingPhase =
  | "SCHEDULED"
  | "LIVE"
  | "ENDED"
  | "CANCELLED"
  | "SOLD"
  | "UNSOLD";

/** The fields a phase depends on — nothing more, so callers can pass a narrow select. */
export interface BiddingWindow {
  status: BiddingStatus;
  startAt: Date;
  endAt: Date;
}

/** What a bid must satisfy — the current high, or its absence. */
export interface BidLadder {
  startingBidPaise: number;
  maxIncreasePaise: number;
  quickBidsPaise: number[];
  highestBidPaise: number | null;
}

export function biddingPhase(window: BiddingWindow, now: Date): BiddingPhase {
  switch (window.status) {
    case "CANCELLED":
      return "CANCELLED";
    case "SOLD":
      return "SOLD";
    case "UNSOLD":
      return "UNSOLD";
    case "OPEN":
      break;
  }

  if (now < window.startAt) return "SCHEDULED";
  // At exactly `endAt` the event is over: the bid guard requires `endAt > now`, so
  // this agrees with what the database will actually accept (spec R26).
  if (now < window.endAt) return "LIVE";
  return "ENDED";
}

export function isAcceptingBids(window: BiddingWindow, now: Date): boolean {
  return biddingPhase(window, now) === "LIVE";
}

/**
 * Whether the product is suspended from normal sale (bidding D8a, spec R33).
 *
 * An event that expires without a bid stops suspending on its own, with nothing to
 * clean up. One that has bids keeps the product held until the platform records an
 * outcome, because it is about to be sold.
 */
export function suspendsPurchase(
  event: BiddingWindow & { bidCount: number },
  now: Date
): boolean {
  if (event.status !== "OPEN") return false;
  return now < event.endAt || event.bidCount > 0;
}

/**
 * The smallest step above the current high. The org's smallest quick-bid amount does
 * this job so the buttons on screen can never contradict the rule (spec R13).
 */
export function minimumIncreasePaise(ladder: Pick<BidLadder, "quickBidsPaise">): number {
  return Math.min(...ladder.quickBidsPaise);
}

/**
 * What this bidder may offer right now, inclusive.
 *
 * With no bids yet the only admissible bid is the starting bid: there is no current
 * high to raise, so there is no increase to make (spec R13/R14).
 */
export function allowedBidRangePaise(ladder: BidLadder): { min: number; max: number } {
  if (ladder.highestBidPaise === null) {
    return { min: ladder.startingBidPaise, max: ladder.startingBidPaise };
  }
  return {
    min: ladder.highestBidPaise + minimumIncreasePaise(ladder),
    max: ladder.highestBidPaise + ladder.maxIncreasePaise,
  };
}

/** The quick-bid amounts that are actually offerable, ascending. */
export function offerableQuickBidsPaise(ladder: BidLadder): number[] {
  if (ladder.highestBidPaise === null) return [];
  const { max } = allowedBidRangePaise(ladder);
  return [...ladder.quickBidsPaise]
    .sort((a, b) => a - b)
    .filter((step) => ladder.highestBidPaise! + step <= max);
}
