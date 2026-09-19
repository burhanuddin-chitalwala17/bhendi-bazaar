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
