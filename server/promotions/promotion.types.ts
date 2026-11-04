/**
 * What the offer engine needs to know, independent of Prisma.
 *
 * These shapes are deliberately narrower than the rows they come from: the engine is
 * pure, so it is unit-testable without a database, and nothing here may carry a value
 * that arrived from a browser (Invariant 1, ADR-0002).
 */

export type PromotionScope = "PLATFORM" | "ORG";
export type PromotionTrigger = "AUTOMATIC" | "CODE";
export type PromotionValueType = "PERCENT" | "AMOUNT_OFF" | "FIXED_PRICE";

/** One narrowing dimension. Exactly one field is set; the database asserts it. */
export interface PromotionTargetRow {
  categoryId: string | null;
  productId: string | null;
}

/** An offer as the engine sees it. */
export interface EnginePromotion {
  id: string;
  label: string;
  scope: PromotionScope;
  /** Set iff scope is ORG. */
  orgId: string | null;
  trigger: PromotionTrigger;
  /** Set iff trigger is CODE. */
  code: string | null;
  valueType: PromotionValueType;
  percentBps: number | null;
  amountOffPaise: number | null;
  fixedPricePaise: number | null;
  /** CODE only — a product page cannot know the basket (promotions D5). */
  maxDiscountPaise: number | null;
  /** CODE only, for the same reason. Measured on the *eligible* base, never the cart. */
  minSubtotalPaise: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
  /**
   * How many times one buyer may use it. Enforced only for a signed-in buyer, since
   * a guest has no identity to count against — so an offer that sets this requires
   * signing in rather than silently not applying.
   */
  perUserLimit: number | null;
  /** PLATFORM only: what it may cost the platform in total, and what it has (offers-hardening D5). */
  platformBudgetPaise: number | null;
  platformSpentPaise: number;
  /** Zero rows means "everything in scope" (promotions D3). */
  targets: PromotionTargetRow[];
}

/** How far back the lowest list price the platform funds on reaches (own-store Q21, offers-hardening D7). */
export const FUNDING_BASIS_DAYS = 30;

/** Org id → its `maxDiscountBps` (offers-hardening D4). An org absent from the map is not clamped. */
export type OrgCeilings = ReadonlyMap<string, number>;

/**
 * A line the engine can discount. `unitPrice` is the catalogue price before any
 * offer — offers compete against each other from the same base (ADR-0019), so a
 * pre-discounted base would make the comparison meaningless.
 */
export interface DiscountableLine {
  /** `productId::size::color`, matching the key the order service already builds. */
  key: string;
  productId: string;
  orgId: string;
  categoryId: string;
  unitPrice: number;
  quantity: number;
  /**
   * The lowest list price in the last 30 days, which the platform's share is worked out on
   * (own-store Q21, offers-hardening D7). Missing means `unitPrice`; never above it.
   */
  fundingBasisUnitPaise?: number;
}

/** What one line ended up with, and who paid for it. */
export interface LineDiscount {
  key: string;
  orgId: string;
  /** What came off the buyer's price for this line. */
  buyerDiscountPaise: number;
  /** The part the organisation bore. The platform bore the remainder. */
  orgFundedPaise: number;
  platformFundedPaise: number;
  /** The offer that set the buyer's figure, if any. */
  winningPromotionId: string | null;
}

/** One row per offer per organisation, matching `OrderDiscount`'s unique key. */
export interface PromotionAttribution {
  promotionId: string;
  orgId: string;
  labelSnapshot: string;
  codeSnapshot: string | null;
  buyerDiscountPaise: number;
  orgFundedPaise: number;
  platformFundedPaise: number;
}

/** Why a code did nothing. A zero-value application is a refusal, never a success. */
export type CouponRejectionReason =
  | "NOT_FOUND"
  | "NOT_LIVE"
  | "EXHAUSTED"
  | "NO_ELIGIBLE_ITEMS"
  | "MIN_SUBTOTAL_NOT_MET"
  | "PER_USER_LIMIT_REACHED"
  | "SIGN_IN_REQUIRED"
  | "ALREADY_BETTER_OFF";

export interface CouponRejection {
  code: string;
  reason: CouponRejectionReason;
  message: string;
  /** How much more of the eligible goods would unlock it, when that is the problem. */
  shortfallPaise?: number;
}

export interface DiscountQuote {
  lines: LineDiscount[];
  attributions: PromotionAttribution[];
  totalDiscountPaise: number;
  /** Present when a code was supplied and did not apply. */
  rejection: CouponRejection | null;
  /** Line keys the applied code covered, for the checkout coverage message. */
  couponCoveredKeys: string[];
}

/** The offers list's status tabs, declared once (offers list Q1). "Live" includes a used-up offer still in its dates. */
export const OFFER_STATUS = {
  ALL: "all",
  LIVE: "live",
  SCHEDULED: "scheduled",
  ENDED: "ended",
  STOPPED: "stopped",
} as const;
export type OfferStatus = (typeof OFFER_STATUS)[keyof typeof OFFER_STATUS];

/** How a buyer gets the offer: on its own, or by typing a code. */
export const OFFER_KIND = { ALL: "all", AUTOMATIC: "automatic", CODE: "code" } as const;
export type OfferKind = (typeof OFFER_KIND)[keyof typeof OFFER_KIND];

/** Columns the list sorts by on the server; anything else in the URL is the default. */
export const OFFER_SORTS = ["createdAt", "label", "startsAt", "endsAt"] as const;
export type OfferSort = (typeof OFFER_SORTS)[number];

export const OFFERS_PAGE_SIZE = 25;

/** One page of the list, as the URL asked for it, already parsed. */
export interface OfferListQuery {
  status: OfferStatus;
  kind: OfferKind;
  /** Trimmed; empty means no search. Matches the name, the code, or a covered product's name or SKU. */
  search: string;
  sortBy: OfferSort;
  sortOrder: "asc" | "desc";
  page: number;
}

/** An offer as the list shows it: integer paise and basis points, the UI formats (Invariant 3). */
export interface OfferListRow {
  id: string;
  label: string;
  trigger: PromotionTrigger;
  code: string | null;
  valueType: PromotionValueType;
  percentBps: number | null;
  amountOffPaise: number | null;
  fixedPricePaise: number | null;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
  /** Platform offers only (offers-hardening D5, D6). */
  platformBudgetPaise: number | null;
  platformSpentPaise: number;
  lossConfirmedAt: Date | null;
  lossConfirmedBy: { name: string | null } | null;
  targets: Array<{ category: { name: string } | null; product: { name: string } | null }>;
}

export interface OfferListResult {
  offers: OfferListRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  /** Per tab, over the whole scope: search and kind narrow the rows, not the tabs. */
  counts: Record<OfferStatus, number>;
}
