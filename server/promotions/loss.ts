/**
 * Could a platform offer cost more than the platform earns on a sale (offers-hardening D6, Q2)?
 *
 * Pure, so the admin form shows the warning from the same rule the server refuses with.
 * Conservative by design: a false warning costs a typed phrase, a missed one costs money.
 */

import { applyBps } from "@server/promotions/allocation";
import type { PromotionValueType } from "@server/promotions/promotion.types";

export const CONFIRM_LOSS_PHRASE = "CONFIRM LOSS";
export const CONFIRM_LOSS_ERROR = "Type CONFIRM LOSS exactly.";
export const LOSS_BUDGET_REQUIRED = "Set a budget for an offer that can lose money.";

export interface LossTestOffer {
  valueType: PromotionValueType;
  percentBps: number | null;
  amountOffPaise: number | null;
  fixedPricePaise: number | null;
  minSubtotalPaise: number;
}

/** True when the offer's depth beats the lowest commission rate on any shop it can reach. */
export function couldCostMoreThanCommission(offer: LossTestOffer, lowestRateBps: number): boolean {
  switch (offer.valueType) {
    case "PERCENT":
      return offer.percentBps !== null && offer.percentBps > lowestRateBps;
    case "AMOUNT_OFF":
      if (offer.amountOffPaise === null) return false;
      // With no minimum spend, a flat amount can exceed any share of a cheap enough item.
      return offer.minSubtotalPaise <= 0 || offer.amountOffPaise > applyBps(offer.minSubtotalPaise, lowestRateBps);
    case "FIXED_PRICE":
      // The prices it marks down are not known at save; treated as able to lose (Q2).
      return offer.fixedPricePaise !== null;
  }
}

/** The amber panel's words (ux.md, admin offer form). */
export function lossWarning(lowestRateBps: number): string {
  return (
    `This can cost more than we earn on a sale (lowest commission ${lowestRateBps / 100}%). ` +
    `Type ${CONFIRM_LOSS_PHRASE} and set a budget to run it anyway.`
  );
}
