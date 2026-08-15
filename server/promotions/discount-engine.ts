/**
 * The one place a discount is decided (ADR-0019).
 *
 * Pure: it takes lines, offers and an instant, and returns amounts. That is what lets
 * the same function price a product page, a checkout preview and the order
 * transaction — and it is why the price advertised and the price charged cannot
 * diverge (ADR-0018).
 *
 * Two evaluation modes, and the split is forced rather than chosen (promotions D5).
 * An automatic offer sets the price shown on a product page, and a product page
 * cannot know the basket — so automatic offers are per line and carry no basket
 * condition. A coupon is entered at checkout, where the basket is known, so it is
 * computed per order and then allocated down.
 */

import { allocateLargestRemainder, applyBps } from "@server/promotions/allocation";
import {
  isExhausted,
  isLive,
  promotionCoversLine,
  type CategoryParents,
} from "@server/promotions/targeting";
import type {
  CouponRejection,
  DiscountQuote,
  DiscountableLine,
  EnginePromotion,
  LineDiscount,
  PromotionAttribution,
} from "@server/promotions/promotion.types";

/** Codes are matched case-insensitively; the stored form is the canonical one. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * What one automatic offer takes off a single unit.
 *
 * Per unit rather than per line, because this figure is what a product page shows.
 * Rounding once per unit and multiplying keeps `displayed × quantity` equal to the
 * line total — rounding the line instead would make them disagree by a paise, and
 * ADR-0018 does not allow the displayed price and the charged price to differ.
 */
export function automaticUnitDiscount(promotion: EnginePromotion, unitPrice: number): number {
  switch (promotion.valueType) {
    case "PERCENT":
      return Math.min(unitPrice, applyBps(unitPrice, promotion.percentBps ?? 0));
    case "AMOUNT_OFF":
      return Math.min(unitPrice, Math.max(0, promotion.amountOffPaise ?? 0));
    case "FIXED_PRICE":
      return Math.max(0, unitPrice - Math.max(0, promotion.fixedPricePaise ?? 0));
  }
}

/** What one coupon takes off its eligible base, after its cap. */
function couponBaseDiscount(promotion: EnginePromotion, basePaise: number): number {
  let discount: number;
  switch (promotion.valueType) {
    case "PERCENT":
      discount = applyBps(basePaise, promotion.percentBps ?? 0);
      break;
    case "AMOUNT_OFF":
      discount = Math.max(0, promotion.amountOffPaise ?? 0);
      break;
    // A fixed selling price is a markdown on one product; it has no meaning applied
    // to a basket. Refused when the offer is created, and zero here as a backstop.
    case "FIXED_PRICE":
      discount = 0;
      break;
  }
  if (promotion.maxDiscountPaise !== null) {
    discount = Math.min(discount, promotion.maxDiscountPaise);
  }
  return Math.min(discount, basePaise);
}

interface Candidate {
  promotionId: string;
  amountPaise: number;
}

/** The better of two candidates; the incumbent keeps a tie, so ordering is stable. */
function better(a: Candidate | null, b: Candidate | null): Candidate | null {
  if (a === null) return b;
  if (b === null) return a;
  return b.amountPaise > a.amountPaise ? b : a;
}

/**
 * The price a buyer sees for one unit, and why (ADR-0018).
 *
 * Display calls this; the order transaction reaches the same numbers through
 * `quoteDiscounts`, which uses the same primitive. A read path that needs a price and
 * does not come through here is a defect.
 */
export function automaticUnitPrice(
  line: Pick<DiscountableLine, "productId" | "orgId" | "categoryId" | "unitPrice">,
  promotions: readonly EnginePromotion[],
  categoryParents: CategoryParents,
  now: Date
): {
  effectivePaise: number;
  discountPerUnitPaise: number;
  promotionId: string | null;
  label: string | null;
} {
  const asLine: DiscountableLine = { ...line, key: line.productId, quantity: 1 };
  let best: Candidate | null = null;
  let bestLabel: string | null = null;

  for (const promotion of promotions) {
    if (promotion.trigger !== "AUTOMATIC") continue;
    if (!isLive(promotion, now) || isExhausted(promotion)) continue;
    if (!promotionCoversLine(promotion, asLine, categoryParents)) continue;

    const amountPaise = automaticUnitDiscount(promotion, line.unitPrice);
    if (amountPaise <= 0) continue;

    const candidate = { promotionId: promotion.id, amountPaise };
    const winner = better(best, candidate);
    if (winner !== best) {
      best = winner;
      bestLabel = promotion.label;
    }
  }

  const discountPerUnitPaise = best?.amountPaise ?? 0;
  return {
    effectivePaise: line.unitPrice - discountPerUnitPaise,
    discountPerUnitPaise,
    promotionId: best?.promotionId ?? null,
    label: bestLabel,
  };
}

export interface QuoteInput {
  lines: readonly DiscountableLine[];
  /** Every candidate offer, live or not — the engine decides, so it can say why. */
  promotions: readonly EnginePromotion[];
  categoryParents: CategoryParents;
  /** What the buyer typed, if anything. A code, never an amount (Invariant 1). */
  code?: string | null;
  /** Null for a guest — an identity the per-buyer limit can be counted against. */
  userId?: string | null;
  /** How many times this buyer has already redeemed the typed code. */
  priorRedemptions?: number;
  now: Date;
}

const REJECTION_MESSAGES: Record<string, string> = {
  NOT_FOUND: "We do not recognise that code.",
  NOT_LIVE: "That offer is not running at the moment.",
  EXHAUSTED: "That offer has been fully claimed.",
};

/**
 * Decide every line's discount and who funded it.
 *
 * The interaction between an automatic offer and a coupon is a per-line maximum
 * (promotions D8): offers compete rather than stack, so a coupon replaces an
 * automatic offer only on the lines where it is worth more, and lines it does not
 * cover keep what they already had. "A line's charged price is never above the price
 * displayed for it" is then a property of that expression rather than a branch.
 */
export function quoteDiscounts(input: QuoteInput): DiscountQuote {
  const { lines, promotions, categoryParents, now } = input;
  const typed = input.code ? normaliseCode(input.code) : null;

  const usable = promotions.filter((p) => isLive(p, now) && !isExhausted(p));

  // ── Automatic offers, per line, per funding scope ──────────────────────────
  const orgAuto = new Map<string, Candidate | null>();
  const platAuto = new Map<string, Candidate | null>();
  const labels = new Map<string, { label: string; code: string | null }>();

  for (const promotion of usable) {
    if (promotion.trigger !== "AUTOMATIC") continue;
    labels.set(promotion.id, { label: promotion.label, code: promotion.code });

    for (const line of lines) {
      if (!promotionCoversLine(promotion, line, categoryParents)) continue;
      const perUnit = automaticUnitDiscount(promotion, line.unitPrice);
      if (perUnit <= 0) continue;

      const candidate = { promotionId: promotion.id, amountPaise: perUnit * line.quantity };
      const bucket = promotion.scope === "ORG" ? orgAuto : platAuto;
      bucket.set(line.key, better(bucket.get(line.key) ?? null, candidate));
    }
  }

  // ── The coupon, per order, then allocated down ─────────────────────────────
  let rejection: CouponRejection | null = null;
  const couponShare = new Map<string, Candidate>();
  let couponScope: "PLATFORM" | "ORG" | null = null;
  const couponCoveredKeys: string[] = [];

  if (typed !== null) {
    const match = promotions.find((p) => p.trigger === "CODE" && p.code === typed);

    if (!match) {
      rejection = { code: typed, reason: "NOT_FOUND", message: REJECTION_MESSAGES.NOT_FOUND };
    } else if (isExhausted(match)) {
      rejection = { code: typed, reason: "EXHAUSTED", message: REJECTION_MESSAGES.EXHAUSTED };
    } else if (!isLive(match, now)) {
      rejection = { code: typed, reason: "NOT_LIVE", message: REJECTION_MESSAGES.NOT_LIVE };
    } else if (match.perUserLimit !== null && !input.userId) {
      // A guest has no identity to count against, so the limit cannot be enforced.
      // Requiring sign-in is the honest answer; applying it anyway would make the
      // limit a suggestion, and silently skipping it would make it a fiction.
      rejection = {
        code: typed,
        reason: "SIGN_IN_REQUIRED",
        message: `Sign in to use ${typed} — it is limited per customer.`,
      };
    } else if (
      match.perUserLimit !== null &&
      (input.priorRedemptions ?? 0) >= match.perUserLimit
    ) {
      rejection = {
        code: typed,
        reason: "PER_USER_LIMIT_REACHED",
        message:
          match.perUserLimit === 1
            ? `You have already used ${typed}.`
            : `You have used ${typed} the maximum ${match.perUserLimit} times.`,
      };
    } else {
      const eligible = lines.filter((line) => promotionCoversLine(match, line, categoryParents));

      if (eligible.length === 0) {
        // A code that reports success and takes nothing off is worse than one that
        // fails, because the buyer only finds out on the payment screen (spec R13).
        rejection = {
          code: typed,
          reason: "NO_ELIGIBLE_ITEMS",
          message: `${typed} does not apply to anything in your basket.`,
        };
      } else {
        const base = eligible.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

        if (base < match.minSubtotalPaise) {
          rejection = {
            code: typed,
            reason: "MIN_SUBTOTAL_NOT_MET",
            message: `${typed} needs a little more of the items it covers.`,
            shortfallPaise: match.minSubtotalPaise - base,
          };
        } else {
          const total = couponBaseDiscount(match, base);
          const shares = allocateLargestRemainder(
            total,
            eligible.map((l) => l.unitPrice * l.quantity)
          );
          eligible.forEach((line, i) => {
            if (shares[i] > 0) {
              couponShare.set(line.key, { promotionId: match.id, amountPaise: shares[i] });
            }
            couponCoveredKeys.push(line.key);
          });
          couponScope = match.scope;
          labels.set(match.id, { label: match.label, code: match.code });
        }
      }
    }
  }

  // ── Per line: compete, then split the funding ──────────────────────────────
  const resolved: LineDiscount[] = [];
  let couponChangedALine = false;

  for (const line of lines) {
    const share = couponShare.get(line.key) ?? null;
    const orgBest = better(orgAuto.get(line.key) ?? null, couponScope === "ORG" ? share : null);
    const platBest = better(platAuto.get(line.key) ?? null, couponScope === "PLATFORM" ? share : null);

    const lineTotal = line.unitPrice * line.quantity;
    const orgAmount = Math.min(orgBest?.amountPaise ?? 0, lineTotal);
    const platAmount = Math.min(platBest?.amountPaise ?? 0, lineTotal);

    const buyerDiscountPaise = Math.max(orgAmount, platAmount);
    // The organisation always bears its own best offer; the platform covers only the
    // remainder needed to reach what the buyer got, floored at zero. That floor is
    // what makes the arrangement asymmetric — the platform tops up to a better offer,
    // it never matches one (org-payouts D2a).
    const orgFundedPaise = orgAmount;
    const platformFundedPaise = buyerDiscountPaise - orgFundedPaise;

    // On a tie the organisation's offer wins, because the platform contributed
    // nothing and attributing a cost to it would misreport the campaign.
    const winner = orgAmount >= platAmount ? orgBest : platBest;

    if (share !== null && winner?.promotionId === share.promotionId) {
      couponChangedALine = true;
    }

    resolved.push({
      key: line.key,
      orgId: line.orgId,
      buyerDiscountPaise,
      orgFundedPaise,
      platformFundedPaise,
      winningPromotionId: buyerDiscountPaise > 0 ? (winner?.promotionId ?? null) : null,
    });
  }

  // A code worth less than what was already running changes nothing, and the buyer is
  // told why rather than left to wonder (spec R14).
  if (rejection === null && typed !== null && !couponChangedALine) {
    rejection = {
      code: typed,
      reason: "ALREADY_BETTER_OFF",
      message: `Your current offer is already better than ${typed}, so we kept it.`,
    };
  }

  // ── One attribution row per offer per organisation ─────────────────────────
  const byPromotionAndOrg = new Map<string, PromotionAttribution>();
  for (const line of resolved) {
    if (line.winningPromotionId === null || line.buyerDiscountPaise === 0) continue;
    const mapKey = `${line.winningPromotionId}::${line.orgId}`;
    const meta = labels.get(line.winningPromotionId);
    const existing = byPromotionAndOrg.get(mapKey) ?? {
      promotionId: line.winningPromotionId,
      orgId: line.orgId,
      labelSnapshot: meta?.label ?? "",
      codeSnapshot: meta?.code ?? null,
      buyerDiscountPaise: 0,
      orgFundedPaise: 0,
      platformFundedPaise: 0,
    };
    existing.buyerDiscountPaise += line.buyerDiscountPaise;
    existing.orgFundedPaise += line.orgFundedPaise;
    existing.platformFundedPaise += line.platformFundedPaise;
    byPromotionAndOrg.set(mapKey, existing);
  }

  return {
    lines: resolved,
    attributions: [...byPromotionAndOrg.values()],
    totalDiscountPaise: resolved.reduce((sum, l) => sum + l.buyerDiscountPaise, 0),
    rejection,
    couponCoveredKeys: rejection === null ? couponCoveredKeys : [],
  };
}
