/**
 * Cancelling a parcel: the reasons offered and the refusals, worded exactly as order-fulfilment
 * ux.md signs them off. Pure, so the sheets can tell a "Contact us" refusal from an "OK" one.
 */

/** Q21: the shop must pick one; the admin picks from the same list. */
export const SHOP_CANCEL_REASON = {
  OUT_OF_STOCK: "out_of_stock",
  DAMAGED: "damaged",
  NO_TIME: "no_time",
  WRONG_PRICE: "wrong_price",
  OTHER: "other",
} as const;
export type ShopCancelReason = (typeof SHOP_CANCEL_REASON)[keyof typeof SHOP_CANCEL_REASON];

export const SHOP_CANCEL_REASON_LABEL: Record<ShopCancelReason, string> = {
  [SHOP_CANCEL_REASON.OUT_OF_STOCK]: "Out of stock",
  [SHOP_CANCEL_REASON.DAMAGED]: "Item damaged",
  [SHOP_CANCEL_REASON.NO_TIME]: "Can't make it in time",
  [SHOP_CANCEL_REASON.WRONG_PRICE]: "Price was wrong",
  [SHOP_CANCEL_REASON.OTHER]: "Other",
};

/** Q21: the buyer's reason is optional, one tap. */
export const BUYER_CANCEL_REASON = {
  MISTAKE: "mistake",
  CHEAPER: "cheaper",
  TOO_SLOW: "too_slow",
  OTHER: "other",
} as const;
export type BuyerCancelReason = (typeof BUYER_CANCEL_REASON)[keyof typeof BUYER_CANCEL_REASON];

export const BUYER_CANCEL_REASON_LABEL: Record<BuyerCancelReason, string> = {
  [BUYER_CANCEL_REASON.MISTAKE]: "Ordered by mistake",
  [BUYER_CANCEL_REASON.CHEAPER]: "Found it cheaper",
  [BUYER_CANCEL_REASON.TOO_SLOW]: "Delivery too slow",
  [BUYER_CANCEL_REASON.OTHER]: "Other",
};

/** "Other" up to 120 characters (ux.md Long content). */
export const CANCEL_OTHER_MAX = 120;

/** The reason as the timeline keeps it: the label, or the person's own words for "Other". */
export function cancelReasonText<R extends string>(labels: Record<R, string>, reason: R | undefined, other: string | undefined, otherKey: R): string | undefined {
  if (!reason) return undefined;
  if (reason === otherKey) return other?.trim() || undefined;
  return labels[reason];
}

/** Every refusal a cancel can answer with. Those ending in "Contact us" get that button; the rest "OK". */
export const CANCEL_REFUSAL = {
  /** Shop, the parcel was marked ready in another tab. */
  shopMarkedReady: "This parcel was marked ready, so it can't be cancelled here. Contact us and we'll help.",
  /** Shop, the buyer got there first. */
  shopBuyerFirst: "The buyer already cancelled this parcel. No fee is charged.",
  /** Buyer, the shop packed it meanwhile. */
  buyerShopPacked: "The shop just packed this. Contact us to stop it.",
  /** Buyer, another tab already cancelled it. */
  buyerAlready: "This order is already cancelled.",
  /** Admin, the courier came first. */
  adminPickedUp: (time: string) => `The courier picked this up at ${time}, so it can't be cancelled. It can only come back as a return.`,
  /** Admin, the buyer or the shop came first. */
  adminAlready: (who: string, time: string) => `Already cancelled by ${who} at ${time}.`,
} as const;

/** Refusals that point to Contact us (ux.md Refused rows whose action is "Contact us"). */
export const CONTACT_US_REFUSALS: readonly string[] = [CANCEL_REFUSAL.shopMarkedReady, CANCEL_REFUSAL.buyerShopPacked];

/** What a cancel reports back: the fee the shop was charged, and the AWB to cancel on Shiprocket. */
export interface CancelResult {
  feePaise: number;
  refundPaise: number;
  awb: string | null;
}

/** A cancelled parcel's refund as its timeline reads it: none is owed when earlier refunds already reached the total. */
export const PARCEL_REFUND = { NONE: "none", OWED: "owed", STARTED: "started" } as const;
export type ParcelRefund = (typeof PARCEL_REFUND)[keyof typeof PARCEL_REFUND];
