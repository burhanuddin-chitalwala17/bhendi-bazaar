// The server's pricing of an order (Invariant 1, ADR-0002). Every branch matters:
// this is the code that decides what a customer is charged, and the request that
// reaches it can say nothing about money — these tests prove the *absence* of
// client influence as much as the presence of correct sums.
import { describe, expect, it } from "vitest";
import {
  catalogueUnitPrice,
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
  weight: 0.5,
  orgId: "org-a",
  sizes: ["S", "M", "L"],
  colors: ["Cream", "Gold"],
  ...overrides,
});

const catalogue = (...rows: PricingProduct[]) => new Map(rows.map((r) => [r.id, r]));

describe("priceGroupItems — variants (order-and-cart-lines D5)", () => {
  it("carries the chosen size and colour onto the priced line, with the unit price paid", () => {
    const [line] = priceGroupItems(
      [{ productId: "p1", quantity: 2, size: "M", color: "Gold" }],
      catalogue(product()),
      "org-a"
    ).items;
    expect(line).toMatchObject({ size: "M", color: "Gold", unitPrice: 120000 });
  });

  it("refuses a size the product never offered — an unfulfillable instruction", () => {
    expect(() =>
      priceGroupItems([{ productId: "p1", quantity: 1, size: "XXL" }], catalogue(product()), "org-a")
    ).toThrow(/not available in size XXL/);
  });

  it("refuses an unoffered colour, and accepts a line with no variant at all", () => {
    expect(() =>
      priceGroupItems([{ productId: "p1", quantity: 1, color: "Neon" }], catalogue(product()), "org-a")
    ).toThrow(/not available in Neon/);
    const { items } = priceGroupItems([{ productId: "p1", quantity: 1 }], catalogue(product()), "org-a");
    expect(items[0].size).toBeUndefined();
  });
});

describe("catalogueUnitPrice — pricing starts from the list price (ADR-0018)", () => {
  it("prices from the catalogue's list price", () => {
    expect(catalogueUnitPrice(product())).toBe(120000);
  });

  it("has no second reduction mechanism to consult", () => {
    // `Product.salePrice` used to be resolved here. A markdown is an offer now, so
    // there is one reduction path rather than two — and, crucially, the reduction is
    // applied by the engine *against this base* rather than baked into it. Pricing
    // from a partly-discounted base is what made a markdown compound with a campaign
    // instead of competing with it (ADR-0019 decision 1).
    expect(catalogueUnitPrice({ price: 90000 })).toBe(90000);
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

  it("totals at the list price, leaving reductions to the offer engine", () => {
    const result = priceGroupItems(
      [{ productId: "p1", quantity: 3 }],
      catalogue(product()),
      "org-a"
    );

    expect(result.itemsTotal).toBe(360000);
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
