/**
 * The shapes bidding hands out.
 *
 * The separation here is load-bearing rather than tidiness: `PublicBiddingView` and
 * `OrgBiddingSummary` have no field that could carry a bidder, so spec R16 and R36
 * hold as a property of the type. Only `BidLadderEntry` names a person, and only the
 * platform's own surfaces are typed to receive it.
 */

import type { BiddingStatus } from "@prisma/client";
import type { BiddingPhase } from "./bidding-window";

export interface BiddingTerms {
  startAt: Date;
  endAt: Date;
  startingBidPaise: number;
  maxIncreasePaise: number;
  quickBidsPaise: number[];
}

/** The product as a bidding surface needs it. */
export interface BiddingProduct {
  id: string;
  slug: string;
  name: string;
  thumbnail: string;
  /// The price when the event opened, not the price now (bidding D9, spec R4).
  referencePricePaise: number;
  size: string | null;
  color: string | null;
}

/**
 * What the public bidding page renders. Carries the amount and the count, never who.
 *
 * `serverNow` travels with it because the countdown must run against the platform's
 * clock rather than the visitor's device (bidding D17, spec R17).
 */
export interface PublicBiddingView extends BiddingTerms {
  id: string;
  slug: string;
  phase: BiddingPhase;
  product: BiddingProduct;
  highestBidPaise: number | null;
  bidCount: number;
  minBidPaise: number;
  maxBidPaise: number;
  soldAmountPaise: number | null;
  serverNow: Date;
}

/** What the selling org sees, at every phase: amounts and counts (bidding D19). */
export interface OrgBiddingSummary extends BiddingTerms {
  id: string;
  slug: string;
  status: BiddingStatus;
  phase: BiddingPhase;
  product: BiddingProduct;
  highestBidPaise: number | null;
  bidCount: number;
  soldAmountPaise: number | null;
  settledAt: Date | null;
  createdAt: Date;
}

/**
 * One rung of the ladder, for the platform only. This is the sole shape that names a
 * bidder, and the only queries that build it sit behind the platform-admin guard
 * (spec R37).
 */
export interface BidLadderEntry {
  id: string;
  amountPaise: number;
  placedAt: Date;
  bidderName: string;
  bidderPhone: string | null;
  bidderEmail: string | null;
  isRegistered: boolean;
}

export interface AdminBiddingDetail extends OrgBiddingSummary {
  orgId: string;
  orgName: string;
  ladder: BidLadderEntry[];
  soldBidId: string | null;
  soldReason: string | null;
}

/** Who is bidding. A guest gives a name and a number; email is optional (spec R22). */
export type BidderIdentity =
  | { kind: "user"; userId: string }
  | { kind: "guest"; name: string; phone: string; email: string | null };

export interface PlaceBidInput {
  slug: string;
  amountPaise: number;
  /// What the page believed the high to be. A mismatch is refused rather than placed
  /// at a figure the bidder did not intend (spec R24).
  expectedHighestBidPaise: number | null;
  bidder: BidderIdentity;
}

export interface CreateBiddingEventInput {
  orgId: string;
  productId: string;
  createdById: string;
  size: string | null;
  color: string | null;
  startAt: Date;
  endAt: Date;
  startingBidPaise: number;
  maxIncreasePaise: number;
  quickBidsPaise: number[];
}

export interface ConfirmSaleInput {
  eventId: string;
  bidId: string;
  amountPaise: number;
  /// Required when the amount differs from the bid, so the record can answer a dispute
  /// months later rather than leaving the difference unexplained (spec R43).
  reason: string | null;
  orgAddressId: string;
  adminId: string;
}
