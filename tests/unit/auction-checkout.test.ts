/**
 * The one exception to catalogue pricing, and the one hole in the purchase gate (ADR-0041).
 *
 * Both are narrow on purpose, so both are pinned from the outside: the auction line must be
 * exactly the auctioned item, once, at the bid; and the gate lets through the claimed
 * auction's own event and nothing else. Widen either and a test here goes red.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { priceAuctionLine, type PricedLine } from "@server/checkout/pricing";
import { noOffers } from "@server/checkout/basket-discounts";

const lockedAmong = vi.fn();
vi.mock("@server/bidding/bidding.repository", () => ({
  biddingRepository: { lockedAmong: (...args: unknown[]) => lockedAmong(...args) },
}));

const { assertNotUnderBidding } = await import("@server/bidding/bidding-lock");

const line = (overrides: Partial<PricedLine> = {}): PricedLine => ({
  productId: "p1",
  productName: "Embroidered sherwani",
  productSlug: "embroidered-sherwani",
  thumbnail: "https://example.com/a.jpg",
  price: 500_000,
  quantity: 1,
  size: "M",
  color: "Ivory",
  unitPrice: 500_000,
  ...overrides,
});

const claim = { productId: "p1", size: "M", color: "Ivory", amountPaise: 345_600 };

describe("priceAuctionLine", () => {
  it("prices the auctioned item at the bid, not the catalogue", () => {
    const priced = priceAuctionLine([line()], claim);
    expect(priced.itemsTotal).toBe(345_600);
    expect(priced.lines).toHaveLength(1);
    expect(priced.lines[0].unitPrice).toBe(345_600);
  });

  it("treats an absent option and a null one as the same", () => {
    const priced = priceAuctionLine([line({ size: undefined, color: undefined })], {
      ...claim,
      size: null,
      color: null,
    });
    expect(priced.itemsTotal).toBe(345_600);
  });

  it.each([
    ["another product", [line({ productId: "p2" })]],
    ["another size", [line({ size: "L" })]],
    ["another colour", [line({ color: "Black" })]],
    ["two units", [line({ quantity: 2 })]],
    ["a second line riding along", [line(), line({ productId: "p2" })]],
    ["nothing at all", []],
  ])("refuses %s rather than repricing it", (_label, lines) => {
    expect(() => priceAuctionLine(lines, claim)).toThrow(/item you won/);
  });
});

describe("noOffers", () => {
  it("discounts nothing and claims no coupon", () => {
    const { discounts, discountByKey } = noOffers();
    expect(discounts.totalDiscountPaise).toBe(0);
    expect(discounts.attributions).toEqual([]);
    expect(discounts.claimedPromotionIds).toEqual([]);
    expect(discountByKey.size).toBe(0);
  });
});

describe("assertNotUnderBidding with a claim", () => {
  const now = new Date("2026-09-28T12:00:00.000Z");

  beforeEach(() => {
    lockedAmong.mockReset();
    lockedAmong.mockResolvedValue([{ productId: "p1", slug: "abc", eventId: "event-1" }]);
  });

  it("refuses everyone without a claim", async () => {
    await expect(assertNotUnderBidding(["p1"], now)).rejects.toThrow(/up for bidding/);
  });

  it("lets the claimed auction's own winner through", async () => {
    await expect(assertNotUnderBidding(["p1"], now, undefined, { eventId: "event-1" })).resolves.toBeUndefined();
  });

  it("does not let a claim on one auction through another's lock", async () => {
    await expect(
      assertNotUnderBidding(["p1"], now, undefined, { eventId: "event-2" })
    ).rejects.toThrow(/up for bidding/);
  });
});
