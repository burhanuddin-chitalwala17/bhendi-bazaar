/**
 * A shop's offers as its deals section shows them (storefront-themes D10; Q12, Q13, Q20, Q36).
 * Pure, so the policy — which offers show and what they say — is tested without a database.
 * The copy is derived from the offer, never typed, so it cannot promise what checkout refuses.
 */

import { formatCurrency } from "@server/shared/money";
import { indiaToday, indiaWeekday } from "@server/shared/india-time";
import { isExhausted, isLive } from "@server/promotions/targeting";
import type { EnginePromotion } from "@server/promotions/promotion.types";

/** An offer row with what it covers named, for the copy. */
export interface StorefrontOfferRow extends Omit<EnginePromotion, "targets"> {
  showOnStorefront: boolean;
  targets: Array<{ categoryName: string | null; productName: string | null }>;
}

export interface StorefrontOfferDto {
  id: string;
  /** The offer's own label (Q13). */
  title: string;
  /** "20% off · All Sarees", "₹100 off orders over ₹999". */
  headline: string;
  /** "Ends Sun 3 Nov" or "Ends today". */
  ends: string;
  /** Only a code the shop ticked "Show on my shop" (Q20). */
  code: string | null;
  /** Ten or fewer uses left on a limited code; never a count (Q36). */
  fewLeft: boolean;
}

export const FEW_LEFT_AT = 10;
export const STOREFRONT_OFFERS_LIMIT = 6;

/**
 * Which offers a shop's page shows, soonest ending first. A sale price is not a card: it is one
 * product's price with no end anyone chose, and the strip shows it with its badge (Q41).
 */
export function storefrontOffers(
  rows: readonly StorefrontOfferRow[],
  options: { now: Date; ceilingBps: number | null },
): StorefrontOfferDto[] {
  return rows
    .filter((row) => row.valueType !== "FIXED_PRICE")
    .filter((row) => row.trigger === "AUTOMATIC" || (row.code !== null && row.showOnStorefront))
    .filter((row) => isLive({ ...row, targets: [] }, options.now) && !isExhausted(row))
    .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime())
    .slice(0, STOREFRONT_OFFERS_LIMIT)
    .map((row) => ({
      id: row.id,
      title: row.label,
      headline: [valueText(row, options.ceilingBps), coverText(row.targets)].filter(Boolean).join(" · "),
      ends: endsText(row.endsAt, options.now),
      code: row.trigger === "CODE" ? row.code : null,
      fewLeft: row.trigger === "CODE" && row.usageLimit !== null && row.usageLimit - row.usageCount <= FEW_LEFT_AT,
    }));
}

/** 2000 bps → "20%", 1250 → "12.5%". */
const percent = (bps: number) => `${Number((bps / 100).toFixed(2))}%`;

/** What it takes off. A percentage reads no deeper than the shop's ceiling, as the engine clamps it. */
function valueText(row: StorefrontOfferRow, ceilingBps: number | null): string {
  const coupon = row.trigger === "CODE";
  const over = coupon && row.minSubtotalPaise > 0 ? ` orders over ${formatCurrency(row.minSubtotalPaise)}` : "";
  if (row.valueType === "PERCENT") {
    const bps = Math.min(row.percentBps ?? 0, ceilingBps ?? Number.POSITIVE_INFINITY);
    const cap = coupon && row.maxDiscountPaise !== null ? ` up to ${formatCurrency(row.maxDiscountPaise)}` : "";
    return `${percent(bps)} off${over}${cap}`;
  }
  // Same figure, two meanings: a coupon's comes off the order, an automatic one off each item.
  return `${formatCurrency(row.amountOffPaise ?? 0)} off${coupon ? over : " each"}`;
}

/** No targets is everything the shop sells, which needs no words (Q13's second example). */
function coverText(targets: StorefrontOfferRow["targets"]): string | null {
  const names = [
    ...targets.flatMap((t) => (t.categoryName ? [`All ${t.categoryName}`] : [])),
    ...targets.flatMap((t) => (t.productName ? [t.productName] : [])),
  ];
  if (names.length <= 2) return names.join(", ") || null;
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

/** `endsAt` is exclusive, so an offer ending at midnight ends on the day before it. */
function endsText(endsAt: Date, now: Date): string {
  const last = new Date(endsAt.getTime() - 1);
  return indiaToday(last) === indiaToday(now) ? "Ends today" : `Ends ${indiaWeekday(last)}`;
}
