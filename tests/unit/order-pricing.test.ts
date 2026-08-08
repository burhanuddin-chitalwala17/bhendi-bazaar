// The server's pricing of an order (Invariant 1, ADR-0002). Every branch matters:
// this is the code that decides what a customer is charged, and the request that
// reaches it can say nothing about money — these tests prove the *absence* of
// client influence as much as the presence of correct sums.
import { describe, expect, it } from "vitest";
import {
  effectiveUnitPrice,
  priceGroupItems,
  assembleOrderTotals,
  type PricingProduct,
} from "@server/checkout/pricing";

const product = (overrides: Partial<PricingProduct> = {}): PricingProduct => ({
  id: "p1",
  name: "Cream Rida",
  slug: "cream-rida",
  thumbnail: "https://cdn.example.com/1.jpg",
  price: 120000, // ₹1,200 in paise
  salePrice: null,
  weight: 0.5,
  orgId: "org-a",
  ...overrides,
});

const catalogue = (...rows: PricingProduct[]) => new Map(rows.map((r) => [r.id, r]));

describe("effectiveUnitPrice — the one place the sale-price rule lives (D6)", () => {
  it("uses the regular price when there is no sale", () => {
    expect(effectiveUnitPrice(product())).toBe(120000);
  });

  it("applies a sale price that is set, positive, and below the regular price", () => {
    expect(effectiveUnitPrice(product({ salePrice: 90000 }))).toBe(90000);
  });

  it("ignores a sale price at or above the regular price", () => {
    expect(effectiveUnitPrice(product({ salePrice: 120000 }))).toBe(120000);
    expect(effectiveUnitPrice(product({ salePrice: 150000 }))).toBe(120000);
  });

  it("ignores a zero sale price", () => {
    expect(effectiveUnitPrice(product({ salePrice: 0 }))).toBe(120000);
  });
});

describe("priceGroupItems", () => {
  it("prices every line from the catalogue — the request had no price to offer", () => {
    const result = priceGroupItems(
      [{ productId: "p1", quantity: 2 }],
      catalogue(product()),
      "org-a"
    );

    expect(result.items[0].price).toBe(120000);
    expect(result.itemsTotal).toBe(240000);
  });

  it("takes name, slug and thumbnail from the catalogue too — order lines are not spoofable history", () => {
    const result = priceGroupItems(
      [{ productId: "p1", quantity: 1 }],
      catalogue(product({ name: "Real Name", slug: "real-slug" })),
      "org-a"
    );

    expect(result.items[0].productName).toBe("Real Name");
    expect(result.items[0].productSlug).toBe("real-slug");
  });

  it("totals with the sale price when one applies", () => {
    const result = priceGroupItems(
      [{ productId: "p1", quantity: 3 }],
      catalogue(product({ salePrice: 100000 })),
      "org-a"
    );

    expect(result.itemsTotal).toBe(300000);
  });

  it("fails the whole group when a product does not exist", () => {
    expect(() =>
      priceGroupItems([{ productId: "ghost", quantity: 1 }], catalogue(product()), "org-a")
    ).toThrowError(/no longer available/);
  });

  it("refuses an item that does not belong to the group's org", () => {
    expect(() =>
      priceGroupItems(
        [{ productId: "p1", quantity: 1 }],
        catalogue(product({ orgId: "org-b" })),
        "org-a"
      )
    ).toThrowError(/does not belong/);
  });

  it("recomputes weight from the catalogue, treating a missing weight as zero", () => {
    const result = priceGroupItems(
      [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
      catalogue(product(), product({ id: "p2", weight: null })),
      "org-a"
    );

    expect(result.totalWeight).toBe(1);
  });
});

describe("assembleOrderTotals", () => {
  it("sums items and shipping into an exact integer grand total", () => {
    const totals = assembleOrderTotals([
      { itemsTotal: 240000, shippingRate: 8000 },
      { itemsTotal: 100000, shippingRate: 12000 },
    ]);

    expect(totals).toEqual({
      itemsTotal: 340000,
      shippingTotal: 20000,
      discount: 0,
      grandTotal: 360000,
    });
  });

  it("has no discount input at all — until a coupon system computes one, it is always zero", () => {
    expect(assembleOrderTotals([]).discount).toBe(0);
  });
});
