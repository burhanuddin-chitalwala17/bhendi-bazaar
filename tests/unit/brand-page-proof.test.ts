/**
 * Proof is derived and floored (brand-page R4, D3): a statistic too small to convince is left
 * out, never shown small. `proofFrom` and `buyersSayFrom` are the one place the floors apply,
 * so a shop at two reviews has no rating and no quoted reviews, one at nine paid orders has no
 * orders figure, and a page with nothing over a floor carries null rather than a card of nulls.
 */
import { describe, expect, it } from "vitest";
import {
  BUYERS_SAY_COUNT,
  PROOF_FLOORS,
  buyersSayFrom,
  proofFrom,
} from "@server/catalog/brand-page-proof";

const { minReviewsForRating: REVIEWS, minOrdersForCount: ORDERS } = PROOF_FLOORS;

describe("proofFrom", () => {
  it("shows the rating from the floor and not one review below it", () => {
    expect(proofFrom({ ratingAverage: 4.5, ratingCount: REVIEWS, paidOrders: 0 })).toEqual({
      rating: { average: 4.5, count: REVIEWS },
      ordersFulfilled: null,
    });
    expect(proofFrom({ ratingAverage: 5, ratingCount: REVIEWS - 1, paidOrders: 0 })).toBeNull();
  });

  it("shows the orders figure from the floor and not one order below it", () => {
    expect(proofFrom({ ratingAverage: null, ratingCount: 0, paidOrders: ORDERS })).toEqual({
      rating: null,
      ordersFulfilled: ORDERS,
    });
    expect(proofFrom({ ratingAverage: null, ratingCount: 0, paidOrders: ORDERS - 1 })).toBeNull();
  });

  it("is null, not a card of nulls, when nothing cleared a floor", () => {
    expect(proofFrom({ ratingAverage: 4.9, ratingCount: REVIEWS - 1, paidOrders: ORDERS - 1 })).toBeNull();
    expect(proofFrom({ ratingAverage: null, ratingCount: 0, paidOrders: 0 })).toBeNull();
  });

  it("carries both when both cleared, the rating to one decimal", () => {
    expect(proofFrom({ ratingAverage: 4.5555, ratingCount: 23, paidOrders: 120 })).toEqual({
      rating: { average: 4.6, count: 23 },
      ordersFulfilled: 120,
    });
    expect(proofFrom({ ratingAverage: 4.04, ratingCount: REVIEWS, paidOrders: 0 })?.rating?.average).toBe(4);
  });

  it("never shows a rating with no average behind it, whatever the count claims", () => {
    expect(proofFrom({ ratingAverage: null, ratingCount: REVIEWS + 2, paidOrders: 0 })).toBeNull();
  });
});

describe("buyersSayFrom", () => {
  const recent = ["r1", "r2", "r3", "r4"];

  it("quotes the declared number once the shop has enough published reviews", () => {
    expect(buyersSayFrom(recent, REVIEWS)).toEqual(recent.slice(0, BUYERS_SAY_COUNT));
    // The two are one constant: a shop that clears the floor always has enough to quote.
    expect(BUYERS_SAY_COUNT).toBe(REVIEWS);
  });

  it("quotes nothing under the rating's floor, even when reviews came back", () => {
    expect(buyersSayFrom(recent.slice(0, REVIEWS - 1), REVIEWS - 1)).toBeNull();
  });

  it("quotes nothing from an empty list, whatever the count claims", () => {
    expect(buyersSayFrom([], REVIEWS + 7)).toBeNull();
  });
});
