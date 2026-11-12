/**
 * Acting on many selected products at once (design-system decisions Q29): the closed sets and the
 * result every bulk action answers with. Money is integer paise (Invariant 3).
 */

/** The most products one bulk request may name: one screen's selection, not a catalogue. */
export const MAX_BULK_PRODUCTS = 200;

/** The highest price a product may carry, in paise: the form's ₹1,00,00,000 ceiling (`rupeeAmount`). */
export const MAX_PRICE_PAISE = 1_000_000_000;

export const BULK_ACTION = {
  PRICE: "price",
  STOCK: "stock",
  ARCHIVE: "archive",
  SEND: "send",
} as const;
export type BulkAction = (typeof BULK_ACTION)[keyof typeof BULK_ACTION];

/** How a bulk price edit moves each price: to one figure, by an amount, or by a percentage. */
export const BULK_PRICE_MODE = {
  SET: "set",
  AMOUNT: "amount",
  PERCENT: "percent",
} as const;
export type BulkPriceMode = (typeof BULK_PRICE_MODE)[keyof typeof BULK_PRICE_MODE];

export type BulkPriceChange =
  | { mode: typeof BULK_PRICE_MODE.SET; pricePaise: number }
  | { mode: typeof BULK_PRICE_MODE.AMOUNT; deltaPaise: number }
  /** Up to two decimals; the result is rounded to the nearest paisa, half away from zero. */
  | { mode: typeof BULK_PRICE_MODE.PERCENT; percent: number };

/** What the audit trail records for a shop's own bulk change; a team change records `PRODUCT_TEAM_ACTION`. */
export const PRODUCT_AUDIT_ACTION = {
  ARCHIVED: "PRODUCT_ARCHIVED",
  RESTORED: "PRODUCT_RESTORED",
  PRICE_SET: "PRODUCT_PRICE_SET",
  STOCK_SET: "PRODUCT_STOCK_SET",
  SENT: "PRODUCT_SENT_TO_MARKETPLACE",
} as const;

/** Why a selected product was left as it was. Closed set, compared by constant. */
export const BULK_SKIP_REASON = {
  /** No such product in the caller's scope: another shop's id reads the same as a missing one. */
  NOT_FOUND: "not_found",
  /** The team does not edit an archived product; the shop restores it first (ADR-0029). */
  ARCHIVED: "archived",
  ALREADY_ARCHIVED: "already_archived",
  /** The change leaves the value where it is. */
  UNCHANGED: "unchanged",
  PRICE_TOO_LOW: "price_too_low",
  PRICE_TOO_HIGH: "price_too_high",
  /** A live bidding event holds the product (product-archive R11). */
  BIDDING_LIVE: "bidding_live",
  /** The location is not one of the product's shop's pickup locations. */
  LOCATION_NOT_FOUND: "location_not_found",
  /** The product has no listing on that marketplace to send to. */
  NOT_ON_MARKETPLACE: "not_on_marketplace",
  /** The listing already matches the product; nothing is waiting. */
  NOTHING_TO_SEND: "nothing_to_send",
  /** A send for this listing is already on its way. */
  SEND_IN_PROGRESS: "send_in_progress",
  /** The product's shop does not hold Channels (subscriptions/feature-access D5). */
  CHANNELS_LOCKED: "channels_locked",
} as const;
export type BulkSkipReason = (typeof BULK_SKIP_REASON)[keyof typeof BULK_SKIP_REASON];

export interface BulkSkippedDTO {
  productId: string;
  reason: BulkSkipReason;
}

/** A stock row that changed after the editor read it: refused, never overwritten (Invariant 6). */
export interface BulkStockConflictDTO {
  productId: string;
  orgAddressId: string;
  seenQuantity: number;
  /** What the location holds now; 0 when it holds no row. */
  currentQuantity: number;
}

export interface BulkActionResultDTO {
  action: BulkAction;
  /** Products changed (price, archive), stock rows written (stock), or sends queued (send). */
  updated: number;
  skipped: BulkSkippedDTO[];
  /** Stock only; empty for every other action. */
  conflicts: BulkStockConflictDTO[];
}

/** One stock row to set: the quantity wanted, against the quantity the editor saw (0 for no row). */
export interface BulkStockRow {
  productId: string;
  orgAddressId: string;
  quantity: number;
  seenQuantity: number;
}

/**
 * Who acts. A shop member is held to its own shop by `orgId`; the team acts across shops and is
 * named on each product it changes (product-form D11), with the reason the shop will read.
 */
export const BULK_ACTOR = { ORG: "org", TEAM: "team" } as const;

export type BulkActor =
  | { kind: typeof BULK_ACTOR.ORG; orgId: string; userId: string }
  | { kind: typeof BULK_ACTOR.TEAM; userId: string; reason: string };
