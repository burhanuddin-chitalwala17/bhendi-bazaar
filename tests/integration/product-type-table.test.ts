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
  let repo: typeof import("@server/listing/product-type.repository").productTypeRepository;
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
    ({ productTypeRepository: repo } = await import("@server/listing/product-type.repository"));
    const fixtures = await ensureFixtures();
    orgId = fixtures.orgId;
    categoryId = fixtures.categoryId;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { slug: { startsWith: stamp } } });
    await prisma.category.updateMany({ where: { id: categoryId }, data: { productType: null } });
  });

  /**
   * The constants are gone, so this pins the data rather than comparing it to itself. The nine
   * shipped as a data migration and a later edit that drops one, or empties its facts, is a
   * silent break: no code fails, the form just stops asking.
   */
  describe("the nine shipped and are intact", () => {
    const EXPECTED: Record<string, { facts: number; measures: number; kinds: number; axis: string[] }> = {
      "islamic-wear": { facts: 9, measures: 6, kinds: 6, axis: ["colour"] },
      trousers: { facts: 10, measures: 2, kinds: 3, axis: ["colour"] },
      "prayer-mat": { facts: 6, measures: 2, kinds: 2, axis: ["colour"] },
      bag: { facts: 10, measures: 3, kinds: 5, axis: ["colour"] },
      "travel-pouch": { facts: 6, measures: 3, kinds: 2, axis: ["colour"] },
      fragrance: { facts: 3, measures: 1, kinds: 3, axis: ["capacity"] },
      jewellery: { facts: 8, measures: 1, kinds: 3, axis: ["plating", "colour"] },
      socks: { facts: 5, measures: 1, kinds: 4, axis: ["colour", "packQuantity"] },
      combo: { facts: 4, measures: 0, kinds: 3, axis: ["colour"] },
    };

    it("has exactly the nine, and every one parses", async () => {
      const rows = await repo.list(true);
      expect(rows.map((r) => r.key).sort()).toEqual(Object.keys(EXPECTED).sort());
    });

    it("carries each type's facts, measures, kinds and axis", async () => {
      for (const [key, want] of Object.entries(EXPECTED)) {
        const row = await repo.byKey(key);
        expect(row, key).not.toBeNull();
        expect(row!.facts.length, `${key} facts`).toBe(want.facts);
        expect(row!.measures.length, `${key} measures`).toBe(want.measures);
        expect(row!.kinds.length, `${key} kinds`).toBe(want.kinds);
        expect(row!.variantAxis, `${key} axis`).toEqual(want.axis);
      }
    });

    /**
     * This store's two largest lines. Rida is a kind rather than a type because the questions
     * are the same as an abaya's and the mapping cost is identical either way; a masalla bag is
     * a combo rather than a bag because mapping it to a bag node would send a buyer a prayer mat
     * they did not read about.
     */
    it("holds rida among Islamic wear, and a masalla set among combos", async () => {
      const islamic = await repo.byKey("islamic-wear");
      expect(islamic?.kinds.map((k) => k.key)).toContain("rida");
      const combo = await repo.byKey("combo");
      expect(combo?.kinds.map((k) => k.key)).toContain("masalla-set");
    });

    // One question with two labels, not two facts — this was dropped by the first migration
    // and carried across by the second.
    it("keeps the per-type wording: cloth is asked its Fabric, everything else its Material", async () => {
      for (const key of ["islamic-wear", "trousers", "socks"]) {
        expect((await repo.byKey(key))?.factLabels.material, key).toBe("Fabric");
      }
      for (const key of ["bag", "prayer-mat", "jewellery"]) {
        expect((await repo.byKey(key))?.factLabels.material, key).toBeUndefined();
      }
    });

    // The ring scale was the one thing claimed to be un-configurable. It is data.
    it("gives jewellery a label scale and nothing else one", async () => {
      const rows = await repo.list(true);
      expect(rows.filter((r) => r.labelScale !== null).map((r) => r.key)).toEqual(["jewellery"]);
    });

    it("records which measurements each type reads a size label from", async () => {
      expect((await repo.byKey("islamic-wear"))?.labelFrom).toContain("bust");
      expect((await repo.byKey("fragrance"))?.labelFrom).toEqual([]);
    });

    it("fetches many in one query, for a screen of mixed types", async () => {
      const many = await repo.byKeys(["bag", "fragrance", "bag", "nope"]);
      expect([...many.keys()].sort()).toEqual(["bag", "fragrance"]);
    });

    it("offers only live types to a picker, and keeps a retired one readable", async () => {
      const prior = await prisma.productType.findUniqueOrThrow({ where: { key: "combo" } });
      await prisma.productType.update({ where: { key: "combo" }, data: { retiredAt: new Date() } });
      try {
        expect((await repo.options()).map((o) => o.key)).not.toContain("combo");
        expect(await repo.byKey("combo")).not.toBeNull();
      } finally {
        await prisma.productType.update({ where: { key: "combo" }, data: { retiredAt: prior.retiredAt } });
      }
    });
  });

  /**
   * These ran against constants the compiler checked. A row is checked by nothing, so they move
   * here — and they are now the check on a type an **admin** creates, which is the case that
   * matters once the screen exists (product-types D3).
   */
  describe("every stored type is internally consistent", () => {
    it("names only facts the vocabulary declares", async () => {
      const { FACTS } = await import("@server/listing/listing-facts");
      for (const type of await repo.list(true)) {
        for (const fact of type.facts) {
          expect(FACTS, `${type.key} asks for an unknown fact "${fact}"`).toContain(fact);
        }
      }
    });

    it("varies only on something it actually asks about", async () => {
      for (const type of await repo.list(true)) {
        const asked = new Set<string>([...type.facts, ...type.measures.map((m) => m.key)]);
        for (const axis of type.variantAxis) {
          expect(asked, `${type.key} varies on "${axis}" but never asks for it`).toContain(axis);
        }
      }
    });

    it("relabels only facts it asks for", async () => {
      for (const type of await repo.list(true)) {
        for (const fact of Object.keys(type.factLabels)) {
          expect(type.facts, `${type.key} relabels "${fact}" without asking it`).toContain(fact);
        }
      }
    });

    it("reads its size label only from measurements it takes", async () => {
      for (const type of await repo.list(true)) {
        const taken = new Set(type.measures.map((m) => m.key));
        for (const key of type.labelFrom) {
          expect(taken, `${type.key} labels from "${key}" but never measures it`).toContain(key);
        }
      }
    });

    it("asks no fact twice, measures nothing twice, and repeats no kind", async () => {
      for (const type of await repo.list(true)) {
        expect(new Set(type.facts).size, `${type.key} asks a fact twice`).toBe(type.facts.length);
        const measures = type.measures.map((m) => m.key);
        expect(new Set(measures).size, `${type.key} measures one thing twice`).toBe(measures.length);
        const kinds = type.kinds.map((k) => k.key);
        expect(new Set(kinds).size, `${type.key} repeats a kind`).toBe(kinds.length);
      }
    });

    it("gives every type at least one kind", async () => {
      for (const type of await repo.list(true)) {
        expect(type.kinds.length, `${type.key} holds no kinds`).toBeGreaterThan(0);
      }
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
      const prior = await prisma.productType.findUniqueOrThrow({ where: { key: "socks" } });
      await prisma.productType.update({ where: { key: "socks" }, data: { retiredAt: new Date() } });
      try {
        const holder = await prisma.product.findFirst({ where: { slug: `${stamp}-holder` } });
        expect(holder?.productType).toBe("socks");
      } finally {
        await prisma.productType.update({ where: { key: "socks" }, data: { retiredAt: prior.retiredAt } });
      }
    });
  });
});
