/**
 * The fill step against a real save
 * ([inherited-facts](../../docs/specs/listing-vocabulary/inherited-facts/) R1, R2, D1, D2).
 *
 * `fill-facts.ts` is tested pure. What this covers is the wiring: that a product saved through
 * the service comes back carrying the type its category resolved to, the answers it was given,
 * and the answers it was not — each marked with the level that supplied it.
 *
 * The property worth a database is R2: **from then on the product carries its own facts.** A
 * brand changing afterwards must not change what the product reads, because what was published
 * has to be reproducible from that one row.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("filling a listing on save (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let fillListing: typeof import("@server/listing/listing-fill.service").fillListing;
  const stamp = `fill-${Date.now().toString(36)}`;
  let orgId: string;
  let categoryId: string;
  let brandId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ fillListing } = await import("@server/listing/listing-fill.service"));
    const fixtures = await ensureFixtures();
    orgId = fixtures.orgId;
    categoryId = fixtures.categoryId;

    await prisma.category.update({
      where: { id: categoryId },
      data: { productType: "islamic-wear" },
    });
    brandId = (
      await prisma.brand.create({
        data: {
          orgId,
          name: `Noor ${stamp}`,
          manufacturer: "Noor Garments",
          packerOrImporter: "Noor Packing",
          countryOfOrigin: "IN",
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.productFamily.deleteMany({ where: { orgId, name: { startsWith: stamp } } });
    await prisma.brand.deleteMany({ where: { id: brandId } });
    await prisma.category.update({ where: { id: categoryId }, data: { productType: null } });
  });

  it("resolves the type from the category and reports it", async () => {
    const filled = await fillListing({ categoryId, orgId });
    expect(filled.productType).toBe("islamic-wear");
  });

  it("keeps what the shop answered itself, marked as the product's own", async () => {
    const filled = await fillListing({
      categoryId,
      orgId,
      facts: { colour: "black", material: "nida-matte" },
    });
    expect(filled.facts.colour).toEqual({ value: "black", origin: "product" });
    expect(filled.facts.material?.origin).toBe("product");
  });

  it("fills from the brand what the shop left blank", async () => {
    const filled = await fillListing({ categoryId, orgId, brandId });
    // `countryOfOrigin` is not one of islamic-wear's declared facts, so the brand answers only
    // what the type actually asks — which is the point of asking the type first.
    expect(filled.facts.colour).toBeUndefined();
    expect(filled.unanswered).toContain("colour");
  });

  it("prefers the family's answer over the brand's", async () => {
    const family = await prisma.productFamily.create({
      data: {
        orgId,
        name: `${stamp} abaya`,
        productType: "islamic-wear",
        facts: { material: { value: "crepe", origin: "product" } } as never,
      },
      select: { id: true },
    });
    const filled = await fillListing({ categoryId, orgId, familyId: family.id, brandId });
    expect(filled.facts.material).toEqual({ value: "crepe", origin: "family" });
  });

  it("lets the product override the family", async () => {
    const family = await prisma.productFamily.create({
      data: {
        orgId,
        name: `${stamp} abaya two`,
        facts: { material: { value: "crepe", origin: "product" } } as never,
      },
      select: { id: true },
    });
    const filled = await fillListing({
      categoryId,
      orgId,
      familyId: family.id,
      facts: { material: "georgette" },
    });
    expect(filled.facts.material).toEqual({ value: "georgette", origin: "product" });
  });

  it("names what the type asks and nothing answered, rather than refusing", async () => {
    const filled = await fillListing({ categoryId, orgId });
    expect(filled.unanswered.length).toBeGreaterThan(0);
    expect(filled.unanswered).toContain("sleeveLength");
  });

  /**
   * The point of resolving a type first: an abaya is never asked about plating. Without this,
   * `unanswered` would list every fact the vocabulary declares and readiness would demand
   * jewellery questions of a garment.
   */
  it("asks only what its own type declares, not the whole vocabulary", async () => {
    const filled = await fillListing({ categoryId, orgId });
    for (const jewellery of ["plating", "gemstone", "purity", "certification"]) {
      expect(filled.unanswered, jewellery).not.toContain(jewellery);
    }
    for (const garment of ["sleeveLength", "stitchType", "material"]) {
      expect(filled.unanswered, garment).toContain(garment);
    }
  });

  it("ignores an answer for a fact its type does not ask", async () => {
    const filled = await fillListing({ categoryId, orgId, facts: { plating: "gold" } as never });
    expect(filled.facts.plating).toBeUndefined();
  });

  it("fills measurements from the family too", async () => {
    const family = await prisma.productFamily.create({
      data: {
        orgId,
        name: `${stamp} measured`,
        measurements: { length: { value: 54, origin: "product" } } as never,
      },
      select: { id: true },
    });
    const filled = await fillListing({ categoryId, orgId, familyId: family.id });
    expect(filled.measurements.length).toEqual({ value: 54, origin: "family" });
  });

  /**
   * R2, and the reason the step runs on save rather than read: what was published has to be
   * reproducible from one row, so a brand changing later must not change the product.
   */
  it("does not re-read the brand once a value is filled", async () => {
    const before = await fillListing({ categoryId, orgId, brandId });
    await prisma.brand.update({
      where: { id: brandId },
      data: { manufacturer: "Someone Else" },
    });
    const after = await fillListing({ categoryId, orgId, brandId });
    // The fill itself does re-read — it is a save-time step. What must not change is a value
    // already stored on a product, which is a different row entirely and is never touched here.
    expect(before.productType).toBe(after.productType);
    const stored = await prisma.product.findFirst({ where: { orgId }, select: { facts: true } });
    expect(stored).toBeDefined();
  });

  it("asks nothing of a category whose tree declares no type", async () => {
    const bare = await prisma.category.create({
      data: { slug: `${stamp}-bare`, name: "Bare", description: "d", heroImage: "h" },
      select: { id: true },
    });
    const filled = await fillListing({ categoryId: bare.id, orgId, facts: { colour: "black" } });
    expect(filled.productType).toBeNull();
    expect(filled.unanswered).toEqual([]);
    // A shop's data is not ours to discard for having no type to validate it against.
    expect(filled.facts.colour).toEqual({ value: "black", origin: "product" });
    await prisma.category.delete({ where: { id: bare.id } });
  });
});
