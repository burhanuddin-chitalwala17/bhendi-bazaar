/**
 * The offer set every price read shares, loaded once per request (promotions D12).
 *
 * Automatic offers set the price shown on listings and product pages, so this read
 * now sits on every storefront render. Loading the whole live set once and matching
 * in memory is what makes that affordable — a query per product here would be fatal,
 * and is the failure mode to watch for if this ever gets refactored.
 *
 * Deliberately memoised no further than a request (ADR-0018 decision 3): prices now
 * change on a clock, so a cache outliving an offer boundary would serve a price the
 * server will refuse at checkout.
 */

import { cache } from "react";
import { promotionRepository } from "@server/promotions/promotion.repository";
import { automaticUnitPrice } from "@server/promotions/discount-engine";
import type { EnginePromotion } from "@server/promotions/promotion.types";
import type { CategoryParents } from "@server/promotions/targeting";

export interface PriceContext {
  promotions: EnginePromotion[];
  categoryParents: CategoryParents;
  now: Date;
}

/**
 * One instant, one offer set, for the whole request.
 *
 * The instant is captured here and passed down rather than read at each call, so a
 * listing cannot price half its tiles either side of an offer's end.
 */
export const loadPriceContext = cache(async (): Promise<PriceContext> => {
  const now = new Date();
  const [promotions, categoryParents] = await Promise.all([
    promotionRepository.listLive(now),
    promotionRepository.categoryParents(),
  ]);
  return { promotions, categoryParents, now };
});

/** A price context with no offers — for callers that must not hit the database. */
export const EMPTY_PRICE_CONTEXT: PriceContext = {
  promotions: [],
  categoryParents: new Map(),
  now: new Date(0),
};

export interface PricedProduct {
  /** The catalogue list price. */
  pricePaise: number;
  /** What the buyer pays per unit after the best automatic offer. */
  offerPricePaise: number;
  /** Null when nothing applies, so callers can test one field rather than compare two. */
  offerLabel: string | null;
}

/**
 * The price a product shows, resolved through the one function checkout also uses
 * (ADR-0018). A read path that needs a price and does not come through here is a
 * defect, not an optimisation.
 */
export function resolveProductPrice(
  product: { id: string; price: number; orgId: string; categoryId: string },
  context: PriceContext
): PricedProduct {
  const resolved = automaticUnitPrice(
    {
      productId: product.id,
      orgId: product.orgId,
      categoryId: product.categoryId,
      unitPrice: product.price,
    },
    context.promotions,
    context.categoryParents,
    context.now
  );

  return {
    pricePaise: product.price,
    offerPricePaise: resolved.effectivePaise,
    offerLabel: resolved.discountPerUnitPaise > 0 ? resolved.label : null,
  };
}
