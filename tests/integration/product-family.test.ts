/**
 * Families against a real schema (listing-vocabulary/variants R2, R3, R6; D2, D3, D6, D9).
 *
 * The rule this suite exists for is that **a family cannot be sold**. It is enforced by the
 * columns not existing rather than by a check, so what can be tested is that they still do not
 * exist — a later migration adding a price or a stock column to `ProductFamily` would reopen the
 * leak silently, and nothing else would notice.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("product families (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let repo: typeof import("@server/listing/product-family.repository").productFamilyRepository;
  const stamp = `fam-${Date.now().toString(36)}`;
  let orgA: string;
  let orgB: string;
  let categoryId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ productFamilyRepository: repo } = await import("@server/listing/product-family.repository"));
    const fixtures = await ensureFixtures();
    orgA = fixtures.orgId;
    categoryId = fixtures.categoryId;
    orgB = (
      await prisma.org.create({
        data: { code: `FAM-${stamp}`, handle: stamp, name: "Family Org", email: `${stamp}@example.invalid` },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const testProducts = await prisma.product.findMany({
      where: { family: { name: { startsWith: stamp } } },
      select: { id: true },
    });
    const testProductIds = testProducts.map((p) => p.id);
    if (testProductIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { productId: { in: testProductIds } } });
      await prisma.product.deleteMany({ where: { id: { in: testProductIds } } });
    }
    await prisma.productFamily.deleteMany({ where: { name: { startsWith: stamp } } });
    await prisma.org.deleteMany({ where: { id: orgB } });
  });

  /**
   * The guard. `ProductStock` keys on a product, and a family has no stock column at all — so a
   * family is not addressable as something to sell, by any route.
   */
  it("has no column that could hold a price or a stock", async () => {
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'ProductFamily'
    `;
    const names = columns.map((c) => c.column_name.toLowerCase());
    expect(names).not.toContain("price");
    expect(names).not.toContain("stock");
    expect(names).not.toContain("quantity");
    expect(names).not.toContain("mrp");
    expect(names.some((n) => n.includes("price"))).toBe(false);
    expect(names.some((n) => n.includes("stock"))).toBe(false);
  });

  it("has no foreign key from ProductStock, so stock cannot point at one", async () => {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'ProductStock'
    `;
    expect(rows.map((r) => r.column_name)).not.toContain("familyId");
  });

  it("creates a family and reads it back scoped to its org", async () => {
    const family = await repo.create({ orgId: orgA, name: `${stamp} abaya`, productType: "islamic-wear" });
    expect(await repo.byId(orgA, family.id)).not.toBeNull();
    expect(await repo.byId(orgB, family.id)).toBeNull();
  });

  it("refuses another org's family on update, as not found rather than forbidden", async () => {
    const family = await repo.create({ orgId: orgA, name: `${stamp} b` });
    expect(await repo.update(orgB, family.id, { name: "hijacked" })).toBeNull();
    expect((await repo.byId(orgA, family.id))?.name).toBe(`${stamp} b`);
  });

  it("refuses to delete a family that has members", async () => {
    const family = await repo.create({ orgId: orgA, name: `${stamp} c` });
    await prisma.product.create({
      data: {
        slug: `${stamp}-c-1`,
        name: "Black",
        description: "d",
        price: 100,
        thumbnail: "t",
        categoryId,
        orgId: orgA,
        familyId: family.id,
      },
    });
    await expect(prisma.productFamily.delete({ where: { id: family.id } })).rejects.toThrow(
      /Foreign key constraint|violates foreign key/i,
    );
  });

  it("retires a family instead, leaving its members readable", async () => {
    const family = await repo.create({ orgId: orgA, name: `${stamp} d` });
    await prisma.product.create({
      data: {
        slug: `${stamp}-d-1`,
        name: "Maroon",
        description: "d",
        price: 100,
        thumbnail: "t",
        categoryId,
        orgId: orgA,
        familyId: family.id,
      },
    });
    expect(await repo.retire(orgA, family.id)).toBe(true);
    const member = await prisma.product.findFirst({ where: { familyId: family.id } });
    expect(member?.name).toBe("Maroon");
    expect((await repo.byId(orgA, family.id))?.retiredAt).toBeInstanceOf(Date);
  });

  it("hides a retired family from the list but not from a direct read", async () => {
    const family = await repo.create({ orgId: orgA, name: `${stamp} e` });
    await repo.retire(orgA, family.id);
    const listed = await repo.list(orgA);
    expect(listed.map((f) => f.id)).not.toContain(family.id);
    expect((await repo.list(orgA, true)).map((f) => f.id)).toContain(family.id);
    expect(await repo.byId(orgA, family.id)).not.toBeNull();
  });

  it("restores a retired family", async () => {
    const family = await repo.create({ orgId: orgA, name: `${stamp} f` });
    await repo.retire(orgA, family.id);
    expect(await repo.restore(orgA, family.id)).toBe(true);
    expect((await repo.byId(orgA, family.id))?.retiredAt).toBeNull();
  });

  it("counts families and sellable things separately, because they are different numbers", async () => {
    const family = await repo.create({ orgId: orgB, name: `${stamp} g` });
    for (const colour of ["black", "maroon", "beige"]) {
      await prisma.product.create({
        data: {
          slug: `${stamp}-g-${colour}`,
          name: colour,
          description: "d",
          price: 100,
          thumbnail: "t",
          categoryId,
          orgId: orgB,
          familyId: family.id,
        },
      });
    }
    const counts = await repo.counts(orgB);
    expect(counts.families).toBe(1);
    expect(counts.sellable).toBe(3);
    expect(await repo.memberCount(orgB, family.id)).toBe(3);
  });

  it("keeps the axis the family was made with, so a later declaration change cannot regroup it", async () => {
    const family = await repo.create({ orgId: orgA, name: `${stamp} h`, variantAxis: ["colour"] });
    expect(family.variantAxis).toEqual(["colour"]);
  });

  it("allows a product with no family, because one colour is one product", async () => {
    const lone = await prisma.product.create({
      data: {
        slug: `${stamp}-lone`,
        name: "Lone",
        description: "d",
        price: 100,
        thumbnail: "t",
        categoryId,
        orgId: orgA,
      },
    });
    expect(lone.familyId).toBeNull();
    await prisma.product.delete({ where: { id: lone.id } });
  });
});
