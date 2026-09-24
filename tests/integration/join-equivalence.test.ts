/**
 * Every relation read in server/ runs relationLoadStrategy "join" (one LATERAL
 * JOIN) instead of Prisma's per-relation query strategy — on per-operation
 * billing the difference is the bill (CHANGELOG PR-71). The strategies must be
 * interchangeable in output, and "join" is the newer, preview-flagged path, so
 * this test pins deep equality between the two over the seeded catalogue for
 * each aggregate's real include shape. A Prisma upgrade that changes join
 * semantics (ordering, filtered nested includes, enum serialisation) fails
 * here, not in production.
 *
 * **Every case asserts it compared something.** Three did not, and passed against CI's empty
 * schema by comparing `[]` to `[]` — a strategy-equivalence test over no rows equates nothing.
 *
 * Needs a populated catalogue, so it runs where one exists and says why when it does not. The
 * seed is destructive and refuses to run in CI (Invariant 7), so this suite is dev-only by
 * construction rather than by accident; `tests/unit/test-integrity.test.ts` holds the list of
 * suites allowed to be data-dependent and lets it shrink only.
 */
import "dotenv/config";
import { describe, it, expect } from "vitest";
import { hasCatalogueData, isDisposableDb } from "../helpers/test-db";


async function bothStrategies(run: (strategy: "join" | "query") => Promise<unknown>) {
  const [joined, queried] = await Promise.all([run("join"), run("query")]);
  return { joined: JSON.parse(JSON.stringify(joined)), queried: JSON.parse(JSON.stringify(queried)) };
}

/** Resolved once, at module scope: a skip decision cannot be made inside `describe`. */
const populated = isDisposableDb && (await hasCatalogueData());

describe.skipIf(!populated)("join/query strategy equivalence (needs a populated catalogue)", () => {
  it("products with the full storefront include tree", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { joined, queried } = await bothStrategies((relationLoadStrategy) =>
      prisma.product.findMany({
        relationLoadStrategy,
        orderBy: { id: "asc" },
        include: {
          category: { select: { slug: true } },
          org: { select: { id: true, name: true, code: true } },
          media: {
            select: { id: true, kind: true, ref: true, description: true, isThumbnail: true },
            orderBy: { position: "asc" },
          },
          stockLocations: {
            where: { orgAddress: { isActive: true } },
            select: {
              quantity: true,
              orgAddress: { select: { address: { select: { pincode: true } } } },
            },
          },
        },
      })
    );
    expect(joined.length).toBeGreaterThan(0);
    expect(joined).toEqual(queried);
  });

  it("orders with items, shipments and their lines", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { joined, queried } = await bothStrategies((relationLoadStrategy) =>
      prisma.order.findMany({
        relationLoadStrategy,
        orderBy: { id: "asc" },
        include: {
          items: { orderBy: { id: "asc" as const } },
          shipments: {
            include: {
              items: {
                include: {
                  orderItem: {
                    include: { product: { select: { name: true, slug: true, thumbnail: true } } },
                  },
                },
              },
            },
          },
        },
      })
    );
    expect(joined.length).toBeGreaterThan(0);
    expect(joined).toEqual(queried);
  });

  it("promotions with targets", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { joined, queried } = await bothStrategies((relationLoadStrategy) =>
      prisma.promotion.findMany({
        relationLoadStrategy,
        orderBy: { id: "asc" },
        include: { targets: true },
      })
    );
    expect(joined.length).toBeGreaterThan(0);
    expect(joined).toEqual(queried);
  });

  it("reviews with their product", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { joined, queried } = await bothStrategies((relationLoadStrategy) =>
      prisma.review.findMany({
        relationLoadStrategy,
        orderBy: { id: "asc" },
        include: { product: { select: { name: true } } },
      })
    );
    expect(joined.length).toBeGreaterThan(0);
    expect(joined).toEqual(queried);
  });

  it("users with profile", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { joined, queried } = await bothStrategies((relationLoadStrategy) =>
      prisma.user.findMany({
        relationLoadStrategy,
        orderBy: { id: "asc" },
        include: { profile: true },
      })
    );
    expect(joined.length).toBeGreaterThan(0);
    expect(joined).toEqual(queried);
  });

  it("orgs with counts and nested stock quantities (order-insensitive)", async () => {
    // The org listing sums these nested quantities, so the repo leaves them
    // unordered — and the two strategies legitimately return them in different
    // orders. Compare as multisets; ordered display lists carry their own
    // orderBy in the repositories precisely because of this difference.
    const { prisma } = await import("@server/shared/prisma");
    const { joined, queried } = await bothStrategies((relationLoadStrategy) =>
      prisma.org.findMany({
        relationLoadStrategy,
        orderBy: [{ isActive: "desc" as const }, { name: "asc" as const }],
        include: {
          _count: { select: { products: true } },
          products: { select: { stockLocations: { select: { quantity: true } } } },
        },
      })
    );
    expect(joined.length).toBeGreaterThan(0);
    type OrgRow = { products: Array<{ stockLocations: Array<{ quantity: number }> }> };
    const normalise = (orgs: OrgRow[]) =>
      orgs.map(({ products, ...org }) => ({
        ...org,
        stockQuantities: products
          .flatMap((product) => product.stockLocations.map((row) => row.quantity))
          .sort((a, b) => a - b),
      }));
    expect(normalise(joined as OrgRow[])).toEqual(normalise(queried as OrgRow[]));
  });

  it("carts with items", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { joined, queried } = await bothStrategies((relationLoadStrategy) =>
      prisma.cart.findMany({
        relationLoadStrategy,
        orderBy: { id: "asc" },
        include: { items: { orderBy: { id: "asc" as const } } },
      })
    );
    expect(joined.length).toBeGreaterThan(0);
    expect(joined).toEqual(queried);
  });
});
