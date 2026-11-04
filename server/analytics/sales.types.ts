/**
 * The admin dashboard's sales figures (design-system Q30). Every amount is integer paise
 * (Invariant 3); the UI formats. Read live, never through the storefront cache (ADR-0065: money is
 * never read from it).
 */

/** The periods the dashboard offers, declared once. */
export const SALES_PERIOD = {
  TODAY: "today",
  WEEK: "7d",
  MONTH: "30d",
} as const;
export type SalesPeriod = (typeof SALES_PERIOD)[keyof typeof SALES_PERIOD];

/** How many India days each period spans, today included. */
export const PERIOD_DAYS: Record<SalesPeriod, number> = {
  [SALES_PERIOD.TODAY]: 1,
  [SALES_PERIOD.WEEK]: 7,
  [SALES_PERIOD.MONTH]: 30,
};

export const isSalesPeriod = (value: unknown): value is SalesPeriod =>
  Object.values(SALES_PERIOD).includes(value as SalesPeriod);

/** One India day of paid sales. */
export interface SalesDay {
  /** "2026-11-04", the India calendar day. */
  day: string;
  paise: number;
  orders: number;
}

/** A figure for this period beside the same figure for the period before it. */
export interface Compared {
  current: number;
  previous: number;
  /** Change in basis points (1240 = +12.4%), rounded half away from zero; null when the previous is 0. */
  changeBps: number | null;
}

/**
 * Sales for a period and the equal period before it (Q30).
 *
 * Counted: orders with `paymentStatus = paid`, dated by `paidAt` (the creation time for rows from
 * before `paidAt` existed), at their stored `grandTotal`. Not counted: unpaid, failed and expired
 * checkouts, and an order every parcel of which was cancelled after payment (`PAID_ORDER_WHERE`,
 * order-fulfilment D4). An order with only some parcels cancelled counts at its full paid total:
 * its refunds are their own queue, not a correction to the day it was paid.
 */
export interface SalesOverview {
  period: SalesPeriod;
  /** Window bounds as ISO instants: current is [from, to), previous is the same length just before. */
  window: { from: string; to: string; previousFrom: string; previousTo: string };
  /** One entry per India day in the period, zero-filled, oldest first. */
  series: SalesDay[];
  /** The same days of the previous period, aligned index for index with `series`. */
  previousSeries: SalesDay[];
  total: Compared;
  orders: Compared;
  /** Total ÷ orders, rounded to the nearest paisa (half up); 0 when there were no orders. */
  averageOrder: Compared;
  /**
   * What the platform kept, from the payouts ledger (org-payouts D2): for each live entry written
   * in the window, goods − both funded discounts − what the shop is owed. That is commission less
   * the platform's campaign cost on a sale, minus it again on a reversal, plus a cancellation fee.
   */
  platformKept: Compared;
  /** Shops with at least one live parcel on a counted order in the window. */
  shopsSelling: Compared;
}

/**
 * One shop's sales for a period and the one before (design-system Q34), from its payouts ledger,
 * dated when each entry was written: a sale at payment, a reversal when a parcel is cancelled.
 */
export interface ShopSalesOverview {
  period: SalesPeriod;
  series: SalesDay[];
  previousSeries: SalesDay[];
  /** What buyers paid for this shop's goods, net of both funded discounts and of cancellations. */
  total: Compared;
  /** Orders paid that included this shop's goods. */
  orders: Compared;
  averageOrder: Compared;
  /** What the shop is owed for the window's entries: sales after commission, less reversals and fees. */
  payable: Compared;
}
