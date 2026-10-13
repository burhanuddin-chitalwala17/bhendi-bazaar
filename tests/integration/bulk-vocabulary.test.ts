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

    // A shop's data is not ours to discard for not fitting a list written afterwards, and the
    // leftovers say which answers the list is missing (categories D8).
    it("keeps an answer matching nothing, flagged rather than dropped", async () => {
      const { resolved, errors } = await resolve(row({ factLabels: { colour: "Peacock Teal" } }));
      expect(resolved.facts.colour).toEqual({
        value: "Peacock Teal",
        origin: "product",
        unlisted: true,
      });
      expect(errors).toEqual([]);
    });

    it("sees a shop's own added answer", async () => {
      await prisma.listingValue.create({
        data: { orgId, list: "colour", key: `${stamp}-own`, label: "Shop Special" },
      });
      const { resolved } = await resolve(row({ factLabels: { colour: "Shop Special" } }));
      expect(resolved.facts.colour?.value).toBe(`${stamp}-own`);
      expect(resolved.facts.colour?.unlisted).toBeUndefined();
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
