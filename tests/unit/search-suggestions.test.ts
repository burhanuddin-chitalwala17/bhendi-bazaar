/**
 * The search dropdown shows a price, so it is a read path bound by ADR-0018: it
 * resolves through the same function the product page and checkout use, and it
 * renders through formatCurrency. It did neither — it printed `product.currency`
 * and `product.price` straight out of the row, so a ₹1,299 product read
 * "INR 129900" and ignored every live offer. These tests hold both halves.
 */
import { describe, it, expect } from "vitest";
import { productService } from "@server/catalog/product.service";
import { EMPTY_PRICE_CONTEXT, type PriceContext } from "@server/promotions/price-context";
import { formatCurrency } from "@/lib/format";
import type { EnginePromotion } from "@server/promotions/promotion.types";

const row = {
  id: "prod-1",
  slug: "okra-basket",
  name: "Okra Basket",
  thumbnail: "cover.jpg",
  price: 129900,
  orgId: "org-1",
  categoryId: "veg",
};

const tenPercentOff: EnginePromotion = {
  id: "promo-1",
  label: "10% off",
  code: null,
  valueType: "PERCENT",
  percentBps: 1000,
  amountOffPaise: null,
  fixedPricePaise: null,
  maxDiscountPaise: null,
  minSubtotalPaise: 0,
  startsAt: new Date("2026-01-01"),
  endsAt: new Date("2027-01-01"),
  isActive: true,
  usageLimit: null,
  usageCount: 0,
  perUserLimit: null,
  scope: "PLATFORM",
  orgId: null,
  trigger: "AUTOMATIC",
  targets: [],
} as EnginePromotion;

const withOffer: PriceContext = {
  promotions: [tenPercentOff],
  categoryParents: new Map([["veg", null]]),
  now: new Date("2026-06-01"),
};

describe("product suggestion rows", () => {
  it("carries integer paise, never a rupee float", () => {
    const suggestion = productService.toSuggestion(row, EMPTY_PRICE_CONTEXT);
    expect(suggestion.price).toBe(129900);
    expect(Number.isInteger(suggestion.price)).toBe(true);
  });

  it("formats to rupees for display — the bug that was reported", () => {
    const suggestion = productService.toSuggestion(row, EMPTY_PRICE_CONTEXT);
    expect(formatCurrency(suggestion.price)).toBe("₹1,299");
    expect(formatCurrency(suggestion.price)).not.toContain("129900");
  });

  it("resolves a live automatic offer, so the dropdown matches the product page", () => {
    const suggestion = productService.toSuggestion(row, withOffer);
    expect(suggestion.price).toBe(129900);
    expect(suggestion.salePrice).toBe(116910);
  });

  it("leaves salePrice undefined when no offer applies", () => {
    const suggestion = productService.toSuggestion(row, EMPTY_PRICE_CONTEXT);
    expect(suggestion.salePrice).toBeUndefined();
  });

  it("carries no field the dropdown does not render", () => {
    const suggestion = productService.toSuggestion(row, EMPTY_PRICE_CONTEXT);
    expect(Object.keys(suggestion).sort()).toEqual([
      "id",
      "name",
      "price",
      "salePrice",
      "slug",
      "thumbnail",
    ]);
  });
});
