/**
 * "Select all" on the products page (design-system Q35): the browser sends the list's filters and
 * the server finds the products. What can go wrong is the server finding the wrong ones: another
 * shop's product that matches the same search, or an action quietly cut to an arbitrary part of
 * a list longer than the cap. Local disposable database, or skip.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const stamp = `selall-${Date.now().toString(36)}`;
const created: string[] = [];

describe.skipIf(!isDisposableDb)("select all matching products (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let dal: typeof import("@/data-access-layer/admin/products.dal").adminProductsDAL;
  let fx: Awaited<ReturnType<typeof ensureFixtures>>;

  const product = async (orgId: string, archived = false) => {
    const row = await prisma.product.create({
      data: {
        slug: `${stamp}-${created.length}`,
        name: `${stamp} piece ${created.length}`,
        description: "Created by tests/integration/product-select-all.test.ts",
        price: 10_000,
        categoryId: fx.categoryId,
        orgId,
        thumbnail: "/brand/bhendi-bazaar.png",
        archivedAt: archived ? new Date() : null,
      },
      select: { id: true },
    });
    created.push(row.id);
    return row.id;
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ adminProductsDAL: dal } = await import("@/data-access-layer/admin/products.dal"));
    fx = await ensureFixtures();
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: created } } });
  });

  it("finds only this shop's products, on the shelf asked for, however the search matches", async () => {
    const mine = [await product(fx.orgId), await product(fx.orgId)];
    const archived = await product(fx.orgId, true);
    const theirs = await product(fx.otherOrgId);

    const ids = await dal.matchingIds({ orgId: fx.orgId, search: stamp }, 200);
    expect([...ids].sort()).toEqual([...mine].sort());
    expect(ids).not.toContain(theirs);
    expect(ids).not.toContain(archived);
  });

  it("refuses a list longer than the cap rather than acting on part of it", async () => {
    await expect(dal.matchingIds({ orgId: fx.orgId, search: stamp }, 1)).rejects.toMatchObject({ status: 422 });
  });
});
