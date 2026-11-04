/**
 * "Needs attention" (design-system Q31): an item is a query, never a stored label. It shows only
 * when the viewer can resolve it now through one action, only past its threshold, and says what
 * waits on it. Ordered money and buyers first, at most five, nothing at zero.
 */

/** The admin's items, in the order they are shown: a buyer's money, a buyer's parcel, a shop's money, then the rest. */
export const ADMIN_ATTENTION = {
  REFUNDS: "refunds",
  PARCELS_TO_BOOK: "parcels-to-book",
  PAYOUTS: "payouts",
  COURIER_CONFLICTS: "courier-conflicts",
} as const;
export type AdminAttentionKey = (typeof ADMIN_ATTENTION)[keyof typeof ADMIN_ATTENTION];

export const ADMIN_ATTENTION_ORDER: readonly AdminAttentionKey[] = [
  ADMIN_ATTENTION.REFUNDS,
  ADMIN_ATTENTION.PARCELS_TO_BOOK,
  ADMIN_ATTENTION.PAYOUTS,
  ADMIN_ATTENTION.COURIER_CONFLICTS,
];

/** At most this many items, on either surface (Q31). */
export const ATTENTION_CAP = 5;

/** Where each item is resolved. Admin routes; the pickups tab values are the page's own. */
export const ADMIN_ATTENTION_HREF: Record<AdminAttentionKey, string> = {
  [ADMIN_ATTENTION.REFUNDS]: "/admin/orders/refunds",
  [ADMIN_ATTENTION.PARCELS_TO_BOOK]: "/admin/orders/pickups?tab=ready",
  [ADMIN_ATTENTION.PAYOUTS]: "/admin/payouts",
  [ADMIN_ATTENTION.COURIER_CONFLICTS]: "/admin/orders/pickups?tab=conflicts",
};

/** A parcel ready for pickup this long without a booking is stale (order-fulfilment ux.md "admin pickups": amber past 24 h). */
export const PARCEL_TO_BOOK_STALE_HOURS = 24;
/**
 * A shop's unclaimed balance is ready to settle once it is above zero (the settlement's own
 * refusal, SETTLEMENT_REFUSALS.notAboveZero) and its oldest entry has had this long to be
 * cancelled or reversed. Payouts has no schedule (org-payouts D7), so the week is this queue's.
 */
export const PAYOUT_READY_AFTER_DAYS = 7;

export interface AdminAttentionItem {
  key: AdminAttentionKey;
  /** How many: refunds, parcels, shops, conflicting AWBs. Never 0 — a zero is not an item. */
  count: number;
  /** What waits on it, besides the count: the buyers behind refunds, the paise owed. Null where none applies. */
  waiting: { buyers?: number; amountPaise?: number } | null;
  /** The oldest thing waiting, ISO; null where age means nothing. */
  oldestAt: string | null;
  href: string;
}

/** The queue as read: empty is the all-clear. */
export interface AdminAttention {
  items: AdminAttentionItem[];
  readAt: string;
}

/** What the queue's one statement answers, before thresholds become items. */
export interface AdminAttentionCounts {
  refunds: { count: number; buyers: number; amountPaise: number; oldestAt: Date | null };
  parcelsToBook: { count: number; oldestAt: Date | null };
  payouts: { shops: number; amountPaise: number; oldestAt: Date | null };
  courierConflicts: { count: number; oldestAt: Date | null };
}

/** The shop's paid parcels still to pack (Home's first line). */
export interface ToPack {
  count: number;
  /** When the longest-waiting buyer paid, ISO; null at zero. */
  oldestPaidAt: string | null;
}

/** Stock that sold in the last 30 days may run out: the only low stock worth a line (Q31). */
export const SELLING_WINDOW_DAYS = 30;

export interface SellingLowStock {
  /** Products on sale, at or below their own threshold, that sold in the window. */
  count: number;
  /** Of those, how many are already at zero. */
  soldOut: number;
  /**
   * Days until the soonest of the rest runs out at its 30-day selling rate, rounded down; null
   * when all are sold out or none is low.
   */
  soonestDays: number | null;
}
