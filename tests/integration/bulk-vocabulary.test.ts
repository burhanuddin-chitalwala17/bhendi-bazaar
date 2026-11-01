/**
 * What a bulk row's answers become ([listing-vocabulary](../../docs/specs/listing-vocabulary/)).
 *
 * The sheet offers **labels** in its dropdowns and a product stores **keys**, because renaming a
 * colour must not rewrite products. Resolving one to the other needs the database, which is what
 * this covers — along with the two rules a row can break: naming a type its category does not
 * use, and naming a kind its type does not hold.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";
import type { BulkProductRow } from "@server/catalog/bulk/bulk.types";

describe.skipIf(!isDisposableDb)("bulk vocabulary (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let loadVocabulary: typeof import("@server/catalog/bulk/bulk-vocabulary").loadVocabulary;
  let resolveRowVocabulary: typeof import("@server/catalog/bulk/bulk-vocabulary").resolveRowVocabulary;
  let categoryRepository: typeof import("@server/catalog/category.read.repository").categoryRepository;
  const stamp = `bv-${Date.now().toString(36)}`;
  let orgId: string;
  let categoryId: string;

  const row = (over: Partial<BulkProductRow> = {}): BulkProductRow => ({
    name: "Black Rida",
    description: "d",
    price: 2500,
    categorySlug: "x",
    weight: 0.6,
    tags: [],
    images: ["a.jpg"],
    stock: {},
    factLabels: {},
    measurements: {},
    ...over,
  });

  async function resolve(input: BulkProductRow) {
    const categories = await categoryRepository.listTree();
    const context = await loadVocabulary([input], categories, orgId);
    return resolveRowVocabulary(input, 2, categoryId, context);
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ loadVocabulary, resolveRowVocabulary } = await import(
      "@server/catalog/bulk/bulk-vocabulary"
    ));
    ({ categoryRepository } = await import("@server/catalog/category.read.repository"));
    const fixtures = await ensureFixtures();
    orgId = fixtures.orgId;
    categoryId = fixtures.categoryId;
    await prisma.category.update({
      where: { id: categoryId },
      data: { productType: "islamic-wear" },
    });
  });

  afterAll(async () => {
    await prisma.category.update({ where: { id: categoryId }, data: { productType: null } });
    await prisma.listingValue.deleteMany({ where: { orgId, list: "colour" } });
  });

  describe("a label becomes the key a product stores", () => {
    it("resolves a dropdown label", async () => {
      const { resolved } = await resolve(row({ factLabels: { colour: "Maroon" } }));
      expect(resolved.facts.colour).toEqual({ value: "maroon", origin: "product" });
    });

    it("is not fussy about case or spacing", async () => {
      const { resolved } = await resolve(row({ factLabels: { colour: "  maroon " } }));
      expect(resolved.facts.colour?.value).toBe("maroon");
    });

    // A sheet round-tripped through an export carries keys; refusing one would punish whoever
    // did the tidier thing.
    it("accepts the key typed directly", async () => {
      const { resolved } = await resolve(row({ factLabels: { colour: "navy-blue" } }));
      expect(resolved.facts.colour?.value).toBe("navy-blue");
    });

    // own-store/bulk-sheet Q8: the sheet offered the list, so a word outside it is a slip, named
    // with the closest listed value — never kept as a guess (was: kept, flagged unlisted).
    it("R5 — refuses an answer outside its list, naming the closest", async () => {
      const { resolved, errors } = await resolve(row({ factLabels: { colour: "Marooon" } }));
      expect(resolved.facts.colour).toBeUndefined();
      expect(errors).toEqual([
        { row: 2, field: "colour", message: "Colour 'Marooon' isn't in the list — pick from the dropdown. Did you mean 'Maroon'?" },
      ]);
    });

    it("R5 — matches a pasted answer whatever its punctuation", async () => {
      const { resolved, errors } = await resolve(row({ factLabels: { colour: "navy_blue." } }));
      expect(errors).toEqual([]);
      expect(resolved.facts.colour?.value).toBe("navy-blue");
    });

    it("R5 — names no closest value when nothing is near", async () => {
      const { errors } = await resolve(row({ factLabels: { colour: "Zzzzzzzz" } }));
      expect(errors[0]?.message).toBe("Colour 'Zzzzzzzz' isn't in the list — pick from the dropdown");
    });

    it("sees a shop's own added answer", async () => {
      await prisma.listingValue.create({
        data: { orgId, list: "colour", key: `${stamp}-own`, label: "Shop Special" },
      });
      const { resolved, errors } = await resolve(row({ factLabels: { colour: "Shop Special" } }));
      expect(resolved.facts.colour?.value).toBe(`${stamp}-own`);
      expect(errors).toEqual([]);
    });
  });

  describe("a row is only asked what its type asks", () => {
    it("drops an answer for a fact this type never asks", async () => {
      const { resolved } = await resolve(row({ factLabels: { plating: "Gold" } }));
      expect(resolved.facts.plating).toBeUndefined();
    });

    it("drops a measurement this type does not take", async () => {
      const { resolved } = await resolve(row({ measurements: { diameter: 17 } }));
      expect(resolved.measurements.diameter).toBeUndefined();
    });

    it("keeps a measurement it does take", async () => {
      const { resolved } = await resolve(row({ measurements: { length: 54, bust: 44 } }));
      expect(resolved.measurements.length).toEqual({ value: 54, origin: "product" });
    });
  });

  describe("the two rules a row can break", () => {
    it("takes the type from the category when the row names none", async () => {
      const { resolved, errors } = await resolve(row());
      expect(resolved.productType).toBe("islamic-wear");
      expect(errors).toEqual([]);
    });

    // Guessing here would publish a product under the wrong category on a marketplace.
    it("refuses a type the category does not resolve to", async () => {
      const { errors } = await resolve(row({ productType: "jewellery" }));
      expect(errors[0]?.field).toBe("productType");
      expect(errors[0]?.message).toContain("islamic-wear");
    });

    it("refuses a type that does not exist", async () => {
      const { errors } = await resolve(row({ productType: "perfume" }));
      expect(errors[0]?.message).toContain("no product type");
    });

    it("accepts a kind its type holds, and refuses one it does not", async () => {
      expect((await resolve(row({ kind: "rida" }))).resolved.kind).toBe("rida");
      const { errors } = await resolve(row({ kind: "trouser" }));
      expect(errors[0]?.field).toBe("kind");
    });

    // The dropdown shows the kind's label; the product stores its key (R2, D6).
    it("R2 — reads a kind by the label the dropdown shows", async () => {
      const type = (await prisma.productType.findUnique({ where: { key: "islamic-wear" } }))!;
      const first = (type.kinds as Array<{ key: string; label: string }>)[0];
      const { resolved, errors } = await resolve(row({ kind: ` ${first.label.toUpperCase()} ` }));
      expect(errors).toEqual([]);
      expect(resolved.kind).toBe(first.key);
    });
  });

  describe("brand by name (R2)", () => {
    it("matches the shop's brand however typed, and refuses another", async () => {
      const brand = await prisma.brand.create({ data: { orgId, name: `${stamp} Noor Studio` } });
      try {
        const { resolved, errors } = await resolve(row({ brandName: `${stamp.toUpperCase()} noor-studio` }));
        expect(errors).toEqual([]);
        expect(resolved.brandId).toBe(brand.id);
        const missed = await resolve(row({ brandName: "Elsewhere Brand" }));
        expect(missed.errors[0]).toMatchObject({ field: "brand" });
        expect(missed.resolved.brandId).toBeNull();
      } finally {
        await prisma.brand.delete({ where: { id: brand.id } });
      }
    });
  });

  describe("nothing here refuses a row for an unanswered question", () => {
    it("resolves a row that answers nothing at all", async () => {
      const { resolved, errors } = await resolve(row());
      expect(errors).toEqual([]);
      expect(resolved.facts).toEqual({});
      expect(resolved.measurements).toEqual({});
    });
  });
});
