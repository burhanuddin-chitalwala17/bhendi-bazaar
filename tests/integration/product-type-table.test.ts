/**
 * Product types as rows, against a real schema
 * (listing-vocabulary/product-types R2, R4, D1, D2, D8, D10).
 *
 * The rule worth a database test is the foreign key. Before this, `Product.productType` was a
 * loose string the compiler checked only where a constant was used — a typo written through any
 * other path would have been stored and published. The key makes spec A4 true by construction,
 * and nothing in `schema.prisma` shows that it references `key` rather than `id`, so this is
 * what keeps it honest.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("product types (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let PRODUCT_TYPES: typeof import("@server/catalog/product-type").PRODUCT_TYPES;
  let PRODUCT_TYPE_DECLARATIONS: typeof import("@server/catalog/product-type").PRODUCT_TYPE_DECLARATIONS;
  const stamp = `pt-${Date.now().toString(36)}`;
  let orgId: string;
  let categoryId: string;

  const product = (slug: string, productType?: string | null) => ({
    slug: `${stamp}-${slug}`,
    name: slug,
    description: "d",
    price: 100,
    thumbnail: "t",
    categoryId,
    orgId,
    ...(productType === undefined ? {} : { productType }),
  });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ PRODUCT_TYPES, PRODUCT_TYPE_DECLARATIONS } = await import("@server/catalog/product-type"));
    const fixtures = await ensureFixtures();
    orgId = fixtures.orgId;
    categoryId = fixtures.categoryId;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: stamp } } });
    await prisma.category.updateMany({ where: { id: categoryId }, data: { productType: null } });
  });

  describe("the nine arrived intact", () => {
    it("has a row for every type the code declares, keyed the same", async () => {
      const rows = await prisma.productType.findMany({ select: { key: true } });
      expect(rows.map((r) => r.key).sort()).toEqual([...PRODUCT_TYPES].sort());
    });

    it("carries each type's facts, measures, axis and kinds unchanged", async () => {
      for (const key of PRODUCT_TYPES) {
        const row = await prisma.productType.findUnique({ where: { key } });
        const declared = PRODUCT_TYPE_DECLARATIONS[key];
        expect(row?.label, key).toBe(declared.label);
        expect(row?.facts, key).toEqual([...declared.facts]);
        expect(row?.variantAxis, key).toEqual([...declared.variantAxis]);
        expect((row?.kinds as { key: string }[]).map((k) => k.key), key).toEqual(
          declared.kinds.map((k) => k.key),
        );
        expect((row?.measures as { key: string }[]).map((m) => m.key), key).toEqual(
          declared.measures.map((m) => m.key),
        );
      }
    });

    // The ring scale was the one thing claimed to be un-configurable. It is data.
    it("gives jewellery a label scale and nothing else one", async () => {
      const rows = await prisma.productType.findMany({ select: { key: true, labelScale: true } });
      const withScale = rows.filter((r) => r.labelScale !== null).map((r) => r.key);
      expect(withScale).toEqual(["jewellery"]);
    });

    it("records which measurements each type reads a size label from", async () => {
      const islamic = await prisma.productType.findUnique({ where: { key: "islamic-wear" } });
      expect(islamic?.labelFrom).toContain("bust");
      const fragrance = await prisma.productType.findUnique({ where: { key: "fragrance" } });
      expect(fragrance?.labelFrom).toEqual([]);
    });
  });

  describe("the foreign key is what makes a typo impossible", () => {
    it("refuses a product naming a type that does not exist", async () => {
      await expect(prisma.product.create({ data: product("bad", "not-a-type") })).rejects.toThrow(
        /Foreign key constraint|violates foreign key/i,
      );
    });

    it("accepts a product naming a real type", async () => {
      const created = await prisma.product.create({ data: product("good", "islamic-wear") });
      expect(created.productType).toBe("islamic-wear");
    });

    // The orphans — masalla bags, beauty and health, kitchen and dining — depend on this.
    it("accepts a product with no type at all, because a foreign key never constrains null", async () => {
      const created = await prisma.product.create({ data: product("none") });
      expect(created.productType).toBeNull();
    });

    it("refuses a category naming a type that does not exist", async () => {
      await expect(
        prisma.category.update({ where: { id: categoryId }, data: { productType: "invented" } }),
      ).rejects.toThrow(/Foreign key constraint|violates foreign key/i);
    });

    it("accepts a category naming a real type, and clearing it again", async () => {
      await prisma.category.update({ where: { id: categoryId }, data: { productType: "bag" } });
      expect((await prisma.category.findUnique({ where: { id: categoryId } }))?.productType).toBe("bag");
      await prisma.category.update({ where: { id: categoryId }, data: { productType: null } });
      expect((await prisma.category.findUnique({ where: { id: categoryId } }))?.productType).toBeNull();
    });
  });

  describe("a type in use is retired, never deleted", () => {
    it("refuses to delete a type a product names", async () => {
      await prisma.product.create({ data: product("holder", "socks") });
      await expect(prisma.productType.delete({ where: { key: "socks" } })).rejects.toThrow(
        /Foreign key constraint|violates foreign key/i,
      );
    });

    it("retires it instead, leaving every product that names it readable", async () => {
      await prisma.productType.update({ where: { key: "socks" }, data: { retiredAt: new Date() } });
      const holder = await prisma.product.findFirst({ where: { slug: `${stamp}-holder` } });
      expect(holder?.productType).toBe("socks");
      await prisma.productType.update({ where: { key: "socks" }, data: { retiredAt: null } });
    });
  });
});
