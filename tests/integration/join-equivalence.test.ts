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
 * Needs the seeded local database; skips anywhere else.
 */
import "dotenv/config";
import { describe, it, expect } from "vitest";

const dbUrl = process.env.DATABASE_URL ?? "";
const isLocalDb = (() => {
  try {
    const url = new URL(dbUrl);
    return (
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/bhendi_bazaar_dev"
    );
  } catch {
    return false;
  }
})();

async function bothStrategies(run: (strategy: "join" | "query") => Promise<unknown>) {
  const [joined, queried] = await Promise.all([run("join"), run("query")]);
  return { joined: JSON.parse(JSON.stringify(joined)), queried: JSON.parse(JSON.stringify(queried)) };
}

describe.skipIf(!isLocalDb)("join/query strategy equivalence (local seeded db)", () => {
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
    expect(joined).toEqual(queried);
  });
});
