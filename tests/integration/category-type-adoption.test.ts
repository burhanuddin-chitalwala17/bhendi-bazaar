/**
 * A category given a type passes it to its products that have none (categories D1b, R7, the safe
 * case), and never to one that already has a type: nothing stored changes meaning.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("a category's new type reaches its untyped products (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orgId: string;
  let userId: string;
  let categoryId: string;
  let childId: string;
  const stamp = Date.now();

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orgId, userId } = await ensureFixtures());
    categoryId = (await prisma.category.create({ data: { name: `Masalla ${stamp}`, slug: `masalla-${stamp}`, description: "", heroImage: "/brand/bhendi-bazaar.png" }, select: { id: true } })).id;
    childId = (await prisma.category.create({ data: { name: `Masalla child ${stamp}`, slug: `masalla-child-${stamp}`, description: "", heroImage: "/brand/bhendi-bazaar.png", parentId: categoryId, productType: "travel-pouch" }, select: { id: true } })).id;
  });
  afterAll(async () => {
    await prisma.product.deleteMany({ where: { orgId, slug: { startsWith: `cta-${stamp}` } } });
    await prisma.category.deleteMany({ where: { id: { in: [childId, categoryId] } } });
  });

  const product = async (s: string, at: string, productType: string | null) =>
    (await prisma.product.create({
      data: { name: `Bag ${s}`, slug: `cta-${stamp}-${s}`, description: "", price: 1000, categoryId: at, thumbnail: "/brand/bhendi-bazaar.png", orgId, productType },
      select: { id: true },
    })).id;

  it("types the untyped products under it, and leaves a typed one and a child with its own type alone", async () => {
    const untyped = await product("none", categoryId, null);
    const typed = await product("typed", categoryId, "fragrance");
    const inChild = await product("child", childId, null);
    const { adminCategoryService } = await import("@server/catalog/admin.category.service");
    await adminCategoryService.updateCategory(categoryId, userId, { productType: "bag" });
    const types = Object.fromEntries((await prisma.product.findMany({ where: { id: { in: [untyped, typed, inChild] } }, select: { id: true, productType: true } })).map((p) => [p.id, p.productType]));
    expect(types[untyped]).toBe("bag");
    expect(types[typed]).toBe("fragrance");
    expect(types[inChild]).toBeNull();
  });
});
