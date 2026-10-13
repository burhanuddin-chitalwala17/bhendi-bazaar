/**
 * Making a family ([variants](../../docs/specs/listing-vocabulary/variants/) R1, R2, R6).
 *
 * The rule a database cannot express is that a family takes its type and its axis **from its
 * category**, the same walk the product form does — so a family asks what its members will be
 * asked. The axis is copied rather than referenced, so reordering a type's declaration later
 * cannot silently regroup a shop's products.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("the family service (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/listing/product-family.service").productFamilyService;
  const stamp = `fs-${Date.now().toString(36)}`;
  let orgId: string;
  let otherOrgId: string;
  let categoryId: string;
  let bareCategoryId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ productFamilyService: service } = await import("@server/listing/product-family.service"));
    const fixtures = await ensureFixtures();
    orgId = fixtures.orgId;
    otherOrgId = fixtures.otherOrgId;
    categoryId = fixtures.categoryId;
    await prisma.category.update({
      where: { id: categoryId },
      data: { productType: "islamic-wear" },
    });
    bareCategoryId = (
      await prisma.category.create({
        data: { slug: `${stamp}-bare`, name: "Bare", description: "d", heroImage: "h" },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.productFamily.deleteMany({ where: { name: { startsWith: stamp } } });
    await prisma.category.update({ where: { id: categoryId }, data: { productType: null } });
    await prisma.category.delete({ where: { id: bareCategoryId } });
  });

  it("takes its type and its axis from the category", async () => {
    const family = await service.create(orgId, { name: `${stamp} abaya`, categoryId });
    expect(family.productType).toBe("islamic-wear");
    expect(family.variantAxis).toEqual(["colour"]);
  });

  // Reordering a type's declaration later must not regroup a shop's products, so the axis is a
  // copy taken at the moment the family was made.
  // The restore is in a `finally`: this mutates reference data every other test in the file
  // reads, so a failure here must not leave the row changed for them. Learned the hard way —
  // an earlier version restored inline and poisoned the suite the first time it went red.
  it("keeps the axis it was made with when the type changes afterwards", async () => {
    const family = await service.create(orgId, { name: `${stamp} frozen`, categoryId });
    const prior = await prisma.productType.findUniqueOrThrow({ where: { key: "islamic-wear" } });
    try {
      await prisma.productType.update({
        where: { key: "islamic-wear" },
        data: { variantAxis: ["colour", "material"] },
      });
      expect((await service.byId(orgId, family.id)).variantAxis).toEqual(["colour"]);
    } finally {
      await prisma.productType.update({
        where: { key: "islamic-wear" },
        data: { variantAxis: prior.variantAxis },
      });
    }
  });

  // A family without a type is legitimate: the siblings still share a description even where
  // nothing has named what makes them differ.
  it("makes a family for a category with no type, carrying no axis", async () => {
    const family = await service.create(orgId, {
      name: `${stamp} untyped`,
      categoryId: bareCategoryId,
    });
    expect(family.productType).toBeNull();
    expect(family.variantAxis).toEqual([]);
  });

  it("refuses a blank name", async () => {
    await expect(service.create(orgId, { name: "   ", categoryId })).rejects.toThrow(/name/i);
  });

  it("scopes every read to the org, so another's family is not found", async () => {
    const family = await service.create(orgId, { name: `${stamp} mine`, categoryId });
    await expect(service.byId(otherOrgId, family.id)).rejects.toThrow(/not found/i);
  });

  it("refuses to update another org's family", async () => {
    const family = await service.create(orgId, { name: `${stamp} theirs`, categoryId });
    await expect(service.update(otherOrgId, family.id, { name: "taken" })).rejects.toThrow(
      /not found/i,
    );
    expect((await service.byId(orgId, family.id)).name).toBe(`${stamp} theirs`);
  });

  it("retires rather than deletes, and says how many members that touches", async () => {
    const family = await service.create(orgId, { name: `${stamp} retiring`, categoryId });
    await prisma.product.create({
      data: {
        slug: `${stamp}-member`,
        name: "Black",
        description: "d",
        price: 100,
        thumbnail: "t",
        categoryId,
        orgId,
        familyId: family.id,
      },
    });
    const result = await service.retire(orgId, family.id);
    expect(result).toEqual({ retired: true, members: 1 });
    // The member is untouched — retiring a family changes none of its products.
    const member = await prisma.product.findFirst({ where: { familyId: family.id } });
    expect(member?.name).toBe("Black");
    await prisma.product.deleteMany({ where: { familyId: family.id } });
  });

  it("hides a retired family from the picker and restores it", async () => {
    const family = await service.create(orgId, { name: `${stamp} hidden`, categoryId });
    await service.retire(orgId, family.id);
    expect((await service.list(orgId)).map((f) => f.id)).not.toContain(family.id);
    expect(await service.restore(orgId, family.id)).toBe(true);
    expect((await service.list(orgId)).map((f) => f.id)).toContain(family.id);
  });

  it("counts families and sellable things as two different numbers", async () => {
    const counts = await service.counts(orgId);
    expect(counts.families).toBeGreaterThan(0);
    expect(typeof counts.sellable).toBe("number");
  });
});
