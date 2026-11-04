/**
 * The offer set every price read shares, loaded once per request (promotions D12).
 *
 * Automatic offers set the price shown on listings and product pages, so this read
 * now sits on every storefront render. Loading the whole live set once and matching
 * in memory is what makes that affordable — a query per product here would be fatal,
 * and is the failure mode to watch for if this ever gets refactored.
 *
 * `loadPriceContext` is memoised no further than a request (ADR-0018 decision 3): prices
 * change on a clock, so a cache outliving an offer boundary would serve a price the
 * server will refuse at checkout. `loadDisplayPriceContext` shares its data across
 * requests and still applies the clock per request (ADR-0065); only what is shown uses it.
 */

import { cache } from "react";
import { promotionRepository } from "@server/promotions/promotion.repository";
import { automaticUnitPrice } from "@server/promotions/discount-engine";
import { commercialTermsService } from "@server/catalog/commercial-terms.service";
import { cachedRead, CACHED_READ_EXPIRY } from "@server/shared/read-cache";
import type { EnginePromotion, OrgCeilings } from "@server/promotions/promotion.types";
import type { CategoryParents } from "@server/promotions/targeting";

export interface PriceContext {
  promotions: EnginePromotion[];
  categoryParents: CategoryParents;
  /** Each shop's discount ceiling, which bounds its own offers here exactly as at checkout. */
  orgCeilings: OrgCeilings;
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
  const [promotions, categoryParents, orgCeilings] = await Promise.all([
    promotionRepository.listLive(now),
    promotionRepository.categoryParents(),
    commercialTermsService.allCeilings(),
  ]);
  return { promotions, categoryParents, orgCeilings, now };
});

/** The tables the display price context reads; held to them by the read-cache table test. */
export const DISPLAY_PRICE_TABLES = ["Promotion", "PromotionTarget", "Category", "Org"] as const;

/**
 * The price context for what a shopper is shown, never for what is charged (ADR-0065). Offers that
 * have not ended come from the shared cache; which have started is decided here, at this request's
 * instant, so ADR-0018's boundary holds without a per-request query. Checkout and the cart keep
 * `loadPriceContext`.
 */
export const loadDisplayPriceContext = cache(async (): Promise<PriceContext> => {
  const { promotions, categoryParents, orgCeilings } = await cachedRead(
    "display-price-context",
    [],
    { tables: DISPLAY_PRICE_TABLES, seconds: CACHED_READ_EXPIRY.slow },
    async () => {
      const [promotions, categoryParents, orgCeilings] = await Promise.all([
        promotionRepository.listNotEnded(new Date()),
        promotionRepository.categoryParents(),
        commercialTermsService.allCeilings(),
      ]);
      return { promotions, categoryParents, orgCeilings };
    },
  );
  const now = new Date();
  return {
    promotions: promotions.filter((p) => p.startsAt <= now && p.endsAt > now),
    categoryParents,
    orgCeilings,
    now,
  };
});

/** A price context with no offers — for callers that must not hit the database. */
export const EMPTY_PRICE_CONTEXT: PriceContext = {
  promotions: [],
  categoryParents: new Map(),
  orgCeilings: new Map(),
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
    context.now,
    context.orgCeilings
  );

  return {
    pricePaise: product.price,
    offerPricePaise: resolved.effectivePaise,
    offerLabel: resolved.discountPerUnitPaise > 0 ? resolved.label : null,
  };
}
