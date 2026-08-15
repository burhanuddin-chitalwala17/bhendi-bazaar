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
  /** Zero rows means "everything in scope" (promotions D3). */
  targets: PromotionTargetRow[];
}

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
