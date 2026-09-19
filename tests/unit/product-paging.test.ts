/**
 * One page size and one URL shape behind every product listing.
 *
 * The three pieces that must agree — the page that renders the first batch, the route
 * that serves the rest, and the grid that decides when to stop — share this module, so
 * what is pinned here is that the URL carries a listing faithfully and that an org is
 * never named by id.
 */
import { describe, expect, it } from "vitest";

import {
  PRODUCT_PAGE_SIZE,
  productPageParams,
  productPageUrl,
} from "@/lib/product-paging";

const params = (url: string) => new URL(url, "https://shop.test").searchParams;

describe("the page URL carries the listing", () => {
  it("always says where to continue from", () => {
    expect(params(productPageUrl({}, 24)).get("offset")).toBe("24");
  });

  it("names a shop by its public handle", () => {
    const q = params(productPageUrl({ handle: "naaz-collection" }, 12));
    expect(q.get("handle")).toBe("naaz-collection");
    // ADR-0030 decision 6: an org id from a browser is the one thing that could widen
    // a storefront listing past its own shop, so it never travels.
    expect(q.has("orgId")).toBe(false);
  });

  it("carries a category, a search and an offers filter together", () => {
    const q = params(
      productPageUrl(
        { handle: "naaz", category: "abayas", search: "kurta", offersOnly: true },
        12
      )
    );
    expect(q.get("category")).toBe("abayas");
    expect(q.get("q")).toBe("kurta");
    expect(q.get("offers")).toBe("1");
  });

  it("omits what the listing does not have, rather than sending empties", () => {
    const q = params(productPageUrl({ category: "abayas" }, 0));
    expect(q.has("handle")).toBe(false);
    expect(q.has("q")).toBe(false);
    expect(q.has("offers")).toBe(false);
  });

  it("round-trips through the route's own parser", () => {
    const query = { handle: "naaz", category: "abayas", offersOnly: true };
    const parsed = productPageParams.parse(
      Object.fromEntries(params(productPageUrl(query, 36)))
    );
    expect(parsed).toMatchObject({
      offset: 36,
      handle: "naaz",
      category: "abayas",
      offers: "1",
    });
  });
});

describe("the parser refuses what a listing should not be asked for", () => {
  it("defaults a missing offset to the first page", () => {
    expect(productPageParams.parse({}).offset).toBe(0);
  });

  it.each([["-1"], ["1.5"], ["abc"], ["99999"]])(
    "refuses offset %s",
    (offset) => {
      expect(productPageParams.safeParse({ offset }).success).toBe(false);
    }
  );

  it("refuses an offers value other than the flag", () => {
    expect(productPageParams.safeParse({ offers: "true" }).success).toBe(false);
  });

  it("keeps the page size a number a grid can reason about", () => {
    expect(Number.isInteger(PRODUCT_PAGE_SIZE)).toBe(true);
    expect(PRODUCT_PAGE_SIZE).toBeGreaterThan(0);
    // 3-up on a phone (ADR-0016): a page that is not a whole number of rows leaves a
    // ragged edge every time one lands.
    expect(PRODUCT_PAGE_SIZE % 3).toBe(0);
  });
});

describe("sorting", () => {
  it("offers new arrivals as the default", async () => {
    const { PRODUCT_SORTS, productPageParams } = await import(
      "@/lib/product-paging"
    );
    expect(PRODUCT_SORTS[0]).toBe("newest");
    expect(productPageParams.parse({}).sort).toBe("newest");
  });

  it("leaves the default out of the URL, so a plain listing stays plain", async () => {
    const { productPageUrl } = await import("@/lib/product-paging");
    expect(
      new URL(productPageUrl({ sort: "newest" }, 0), "https://x.test").searchParams.has(
        "sort"
      )
    ).toBe(false);
  });

  it("carries a price sort through", async () => {
    const { productPageUrl } = await import("@/lib/product-paging");
    const q = new URL(
      productPageUrl({ sort: "price-asc" }, 12),
      "https://x.test"
    ).searchParams;
    expect(q.get("sort")).toBe("price-asc");
  });

  it("refuses a sort the listing does not have", async () => {
    const { productPageParams } = await import("@/lib/product-paging");
    expect(productPageParams.safeParse({ sort: "rating" }).success).toBe(false);
  });
});

describe("price sorting uses the price a shopper is asked to pay", () => {
  it("takes the offer price when one applies", async () => {
    const { effectivePrice } = await import("@/domain/product");
    // The case the whole thing turns on: ₹100 reduced to ₹75 sorts as 75.
    expect(effectivePrice({ price: 10000, salePrice: 7500 })).toBe(7500);
  });

  it("takes the list price when there is no offer", async () => {
    const { effectivePrice } = await import("@/domain/product");
    expect(effectivePrice({ price: 10000 })).toBe(10000);
    expect(effectivePrice({ price: 10000, salePrice: null })).toBe(10000);
  });

  it.each([
    [0, "zero is not a price, it is a missing one"],
    [10000, "equal to list is not a reduction"],
    [12000, "above list is not a reduction"],
  ])("ignores a sale price of %s — %s", async (salePrice) => {
    const { effectivePrice } = await import("@/domain/product");
    expect(effectivePrice({ price: 10000, salePrice })).toBe(10000);
  });

  it("orders a reduced item by what it costs now, not what it cost", async () => {
    const { effectivePrice } = await import("@/domain/product");
    const cheapAfterOffer = { price: 100000, salePrice: 5000 };
    const plainlyCheap = { price: 9000 };
    // Sorting by the column would put the ₹1,000 item first; the shopper sees ₹50.
    expect(effectivePrice(cheapAfterOffer)).toBeLessThan(effectivePrice(plainlyCheap));
  });
});
