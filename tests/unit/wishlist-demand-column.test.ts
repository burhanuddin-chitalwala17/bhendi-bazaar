/**
 * The org and admin product tables show demand beside stock: how many users have saved
 * each product. Pinned here — the count is grouped in SQL, absent means zero, and the
 * catalog repository never learns to read `WishlistItem` itself (ADR-0003/ADR-0012).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const groupBy = vi.fn();

vi.mock("@server/shared/prisma", () => ({
  prisma: {
    wishlistItem: { groupBy: (args: unknown) => groupBy(args) },
  },
}));

const { wishlistRepository } = await import("@server/wishlist/wishlist.repository");

beforeEach(() => {
  groupBy.mockReset();
});

describe("countByProductIds", () => {
  it("returns one count per saved product", async () => {
    groupBy.mockResolvedValue([
      { productId: "p-1", _count: { _all: 3 } },
      { productId: "p-2", _count: { _all: 1 } },
    ]);

    const counts = await wishlistRepository.countByProductIds(["p-1", "p-2", "p-3"]);

    expect(counts.get("p-1")).toBe(3);
    expect(counts.get("p-2")).toBe(1);
    // Nobody saved p-3, so there is no row for it. The caller defaults it to zero.
    expect(counts.has("p-3")).toBe(false);
  });

  it("asks only about the products on the page, so the query cannot grow with the catalogue", async () => {
    groupBy.mockResolvedValue([]);

    await wishlistRepository.countByProductIds(["p-1", "p-2"]);

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["productId"],
        where: { productId: { in: ["p-1", "p-2"] } },
      })
    );
  });

  it("does not go to the database for an empty page", async () => {
    expect(await wishlistRepository.countByProductIds([])).toEqual(new Map());
    expect(groupBy).not.toHaveBeenCalled();
  });
});

describe("who may read the saves", () => {
  it("keeps WishlistItem behind its own repository — catalog asks, it does not join", () => {
    const catalogRepo = readFileSync("server/catalog/admin.product.repository.ts", "utf8");
    expect(catalogRepo).not.toMatch(/wishlist/i);
  });

  it("reaches the count through the wishlist service, not its repository", () => {
    const dal = readFileSync("src/data-access-layer/admin/products.dal.ts", "utf8");
    expect(dal).toMatch(/wishlistService\.countSavesByProduct/);
    expect(dal).not.toMatch(/wishlistRepository/);
  });

  it("shows the count and never sorts on it — the merge happens after the page is chosen", () => {
    const table = readFileSync(
      "src/admin/products/productsList/components/ProductsTable.tsx",
      "utf8"
    );
    const column = table.slice(
      table.indexOf('key: "wishlistCount"'),
      table.indexOf('key: "badges"')
    );
    expect(column).toMatch(/label: "Wishlisted"/);
    expect(column).not.toMatch(/sortable/);
  });
});
