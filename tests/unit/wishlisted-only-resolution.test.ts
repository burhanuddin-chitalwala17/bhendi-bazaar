/**
 * How "wishlisted only" reaches the catalogue.
 *
 * The demand column is merged in after the page is chosen, so it cannot narrow a
 * result set. This filter therefore resolves first: the wishlist domain answers in
 * product ids, the catalog query filters on them, and neither reads the other's table
 * (ADR-0003, ADR-0012). The id list also has to survive being empty — "nobody saved
 * anything" must return no rows, not every row.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const getProducts = vi.fn();
const listSavedProductIds = vi.fn();

vi.mock("@server/catalog/admin.product.service", () => ({
  productsService: { getProducts: (f: unknown) => getProducts(f), getStats: vi.fn() },
}));
vi.mock("@server/wishlist/wishlist.service", () => ({
  wishlistService: {
    listSavedProductIds: (orgId?: string) => listSavedProductIds(orgId),
    countSavesByProduct: async () => new Map(),
  },
}));
vi.mock("@server/promotions/price-context", () => ({
  loadPriceContext: async () => ({ promotions: [], categoryParents: new Map(), now: new Date() }),
  resolveProductPrice: (p: { price: number }) => ({
    pricePaise: p.price,
    offerPricePaise: p.price,
  }),
}));

const { adminProductsDAL } = await import("@/data-access-layer/admin/products.dal");

const emptyPage = {
  products: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
};

beforeEach(() => {
  getProducts.mockReset().mockResolvedValue(emptyPage);
  listSavedProductIds.mockReset().mockResolvedValue(["p-1", "p-2"]);
});

describe("resolving the filter", () => {
  it("asks nothing of the wishlist when the switch is off", async () => {
    await adminProductsDAL.getProducts({ orgId: "org-1" });
    expect(listSavedProductIds).not.toHaveBeenCalled();
    expect(getProducts.mock.calls[0][0].productIds).toBeUndefined();
  });

  it("turns the flag into ids the catalogue can filter on", async () => {
    await adminProductsDAL.getProducts({ orgId: "org-1", wishlistedOnly: true });
    expect(getProducts.mock.calls[0][0].productIds).toEqual(["p-1", "p-2"]);
  });

  it("scopes the lookup to the org, so a portal never sees another org's demand", async () => {
    await adminProductsDAL.getProducts({ orgId: "org-1", wishlistedOnly: true });
    expect(listSavedProductIds).toHaveBeenCalledWith("org-1");
  });

  it("passes no org for the platform's cross-vendor view", async () => {
    await adminProductsDAL.getProducts({ wishlistedOnly: true });
    expect(listSavedProductIds).toHaveBeenCalledWith(undefined);
  });

  it("sends an empty list rather than dropping the filter when nothing is saved", async () => {
    listSavedProductIds.mockResolvedValue([]);
    await adminProductsDAL.getProducts({ orgId: "org-1", wishlistedOnly: true });
    expect(getProducts.mock.calls[0][0].productIds).toEqual([]);
  });

  it("never forwards the flag itself — catalog filters on ids, not on wishes", async () => {
    await adminProductsDAL.getProducts({ orgId: "org-1", wishlistedOnly: true });
    expect(getProducts.mock.calls[0][0]).not.toHaveProperty("wishlistedOnly");
  });
});

describe("the domain boundary still holds", () => {
  // That catalog names no wishlist table is pinned by wishlist-demand-column.test.ts,
  // which owns that rule — and which caught a comment of this filter's naming it.
  it("filters on an empty array instead of falling through on truthiness", () => {
    const repo = readFileSync("server/catalog/admin.product.repository.ts", "utf8");
    // `[] && …` is truthy, so a truthiness test would have worked by accident here and
    // broken the day someone rewrote it. The undefined check is the load-bearing part.
    expect(repo).toMatch(/productIds !== undefined/);
  });
});
