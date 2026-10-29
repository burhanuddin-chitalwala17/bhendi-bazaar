import type { Prisma } from "@prisma/client";

import { promotionService } from "@server/promotions/promotion.service";
import { lineKey, type PricedLine } from "@server/checkout/pricing";

/**
 * The bridge between a priced basket and the offer engine.
 *
 * Checkout knows lines; `promotions` needs each line's org and category to decide which offer
 * reaches it ([ADR-0019](../../docs/adr/0019-discount-is-one-winning-offer.md)). Translating
 * between the two shapes was eleven lines in the middle of the order transaction, which is why
 * `order.service.ts` imported the promotion engine at all. Here it is one named step, and
 * checkout stops having promotions as a reason to change.
 *
 * **Runs inside the order transaction, deliberately.** Offers are decided from persisted rows at
 * one instant, so the preview and the charge are priced from the same moment
 * ([ADR-0018](../../docs/adr/0018-one-effective-price-function.md)) — and `applyToOrder` also
 * *claims* a limited coupon with a conditional write, so a coupon with three uses left cannot be
 * spent four times by concurrent checkouts (promotions D11, ADR-0007).
 */

/** What a line needs to be discountable: who sells it and where it sits in the category tree. */
export interface DiscountableProduct {
  orgId: string;
  categoryId: string;
}

export async function applyOffersToBasket(args: {
  pricedLines: PricedLine[];
  products: Map<string, DiscountableProduct>;
  /** The only promotional input a request may carry — never an amount (Invariant 1). */
  couponCode?: string;
  /** A per-buyer limit needs an identity to count against; a guest has none. */
  userId: string | null;
  now: Date;
  tx: Prisma.TransactionClient;
}) {
  const { pricedLines, products, couponCode, userId, now, tx } = args;

  const discountableLines = pricedLines.map((line) => {
    const product = products.get(line.productId);
    if (!product) {
      // Every priced line was priced from a product read in this same transaction, so a miss
      // here is an internal inconsistency rather than bad input — worth failing loudly instead
      // of silently discounting nothing.
      throw new Error(`Priced line ${line.productId} has no product in this transaction`);
    }
    return {
      key: lineKey(line),
      productId: line.productId,
      orgId: product.orgId,
      categoryId: product.categoryId,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
    };
  });

  const discounts = await promotionService.applyToOrder(discountableLines, {
    code: couponCode,
    userId,
    now,
    tx,
  });

  return {
    discounts,
    /** Each line's allocated share, by the same key the order items are built from. */
    discountByKey: new Map(discounts.lines.map((line) => [line.key, line])),
  };
}
