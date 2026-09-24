/**
 * Every sort key a listing declares can actually be served by the database.
 *
 * Two could not, and had not been able to since 2026-08-04: `?sortBy=total` on orders (the
 * column is `grandTotal`) and `?sortBy=totalSpent` on users (summed in JavaScript, so no
 * `orderBy` can serve it at all). Both reached Prisma as unknown arguments and threw. They
 * survived because the route cast the query string with `as any`, which made an invalid key look
 * valid all the way down to the query builder, and because nothing ever asked for that sort.
 *
 * A declared vocabulary that nothing exercises is a promise nobody checked. This asks each
 * listing for every key it offers and fails on the first that throws — the only way to know,
 * since the mismatch is between a TypeScript union and a Postgres column and no compiler sees
 * both.
 *
 * Adding a listing means adding a row here. That is the point: the cost of the guard is one line
 * per endpoint, and the thing it prevents is a filter the console offers and the database refuses.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";
import { isDisposableDb } from "../helpers/test-db";


/** One row per listing: the keys it declares, and how to ask it for one. */
interface Listing {
  name: string;
  /** Must match the `sortBy` union in that listing's filter type, exactly. */
  keys: readonly string[];
  run: (sortBy: string, sortOrder: "asc" | "desc") => Promise<unknown>;
}

describe.skipIf(!isDisposableDb)("every declared sort key can be served", () => {
  let listings: Listing[];

  beforeAll(async () => {
    const [users, orders, carts, categories, products, reviews] = await Promise.all([
      import("@server/identity/admin.user.service"),
      import("@server/checkout/admin.order.service"),
      import("@server/cart/admin.cart.service"),
      import("@server/catalog/admin.category.service"),
      import("@server/catalog/admin.product.service"),
      import("@server/catalog/review.repository"),
    ]);

    listings = [
      {
        name: "admin users",
        keys: ["createdAt", "lastActiveAt"],
        run: (sortBy, sortOrder) =>
          users.adminUserService.getUsers({ page: 1, limit: 5, sortBy, sortOrder } as never),
      },
      {
        name: "admin orders",
        keys: ["createdAt", "updatedAt", "total"],
        run: (sortBy, sortOrder) =>
          orders.adminOrderService.getOrders({ page: 1, limit: 5, sortBy, sortOrder } as never),
      },
      {
        name: "abandoned carts",
        keys: ["updatedAt"],
        run: (sortBy, sortOrder) =>
          carts.adminCartService.getAbandonedCarts({ page: 1, limit: 5, sortBy, sortOrder } as never),
      },
      {
        name: "admin categories",
        keys: ["order", "name", "createdAt"],
        run: (sortBy, sortOrder) =>
          categories.adminCategoryService.getCategories({ page: 1, limit: 5, sortBy, sortOrder } as never),
      },
      {
        name: "admin products",
        keys: ["name", "createdAt", "price", "stock"],
        run: (sortBy, sortOrder) =>
          products.productsService.getProducts({ page: 1, limit: 5, sortBy, sortOrder } as never),
      },
      {
        name: "admin reviews",
        keys: ["createdAt", "rating"],
        run: (sortBy, sortOrder) =>
          reviews.reviewRepository.getReviews({ page: 1, limit: 5, sortBy, sortOrder } as never),
      },
    ];
  });

  it("the guard covers every listing that declares a sort vocabulary", async () => {
    // A listing added without a row here is one this guard silently stops protecting, so the
    // count is asserted against the declarations themselves rather than trusted.
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join, resolve } = await import("node:path");
    const root = resolve(__dirname, "../../server");
    const declared: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".ts") && /^\s*sortBy\?:/m.test(readFileSync(p, "utf8"))) declared.push(p);
      }
    };
    walk(root);
    // A walk that found nothing would make the count below compare 0 to 0 if the listings
    // array were ever emptied too. Cheap to state outright.
    expect(declared.length).toBeGreaterThan(5);
    // `admin.product.domain.types.ts` restates the product vocabulary for the org console; one
    // listing, two declarations.
    expect(
      new Set(declared.map((f) => f.replace(/.*\//, "").replace(".domain", ""))).size,
      `${declared.length} files declare a sortBy; ${listings.length} listings are covered here`,
    ).toBe(listings.length);
  });

  it("asks each listing for every key it offers", async () => {
    const broken: string[] = [];
    for (const listing of listings) {
      for (const key of listing.keys) {
        for (const order of ["asc", "desc"] as const) {
          try {
            await listing.run(key, order);
          } catch (error) {
            broken.push(
              `${listing.name} sortBy=${key} ${order}: ${String((error as Error).message).split("\n").pop()?.trim()}`,
            );
          }
        }
      }
    }
    expect(
      broken,
      "These sorts are offered by a filter type and refused by the database. Either map the key " +
        "to the column it means, or remove it — a sort that throws is worse than one that is not " +
        "offered:\n" + broken.map((b) => `    ${b}`).join("\n"),
    ).toEqual([]);
  });
});
