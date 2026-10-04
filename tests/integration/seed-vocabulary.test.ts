/**
 * The seeded catalogue answers questions the vocabulary actually asks, with values it actually
 * permits ([categories](../../docs/specs/listing-vocabulary/categories/) D3, D5).
 *
 * A seed that invents an answer produces a dev database where the readiness gate agrees with
 * nothing and every product looks broken — or worse, looks fine while proving nothing. The
 * values are checked against the `ListingValue` rows a migration ships, so this fails the day
 * someone retires a value the seed still uses.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";

import { ANSWER, FACT_DECLARATIONS, type FactKey } from "@server/catalog/listing-facts";
import { seedCategories } from "../../prisma/seed/categories.seed";
import { seedProducts } from "../../prisma/seed/products.seed";
import { isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("the seeded catalogue (local db)", () => {
  let types: Map<string, { facts: string[]; kinds: Set<string>; measures: Set<string> }>;
  let permitted: Set<string>;

  /** A category's own type, else the nearest ancestor's — the walk the seed itself does. */
  const typeOf = (categoryId: string): string | undefined => {
    const byId = new Map(seedCategories.map((c) => [c.id, c]));
    let at = byId.get(categoryId);
    const seen = new Set<string>();
    while (at && !seen.has(at.id)) {
      if (at.productType) return at.productType;
      seen.add(at.id);
      at = at.parentId ? byId.get(at.parentId) : undefined;
    }
    return undefined;
  };

  const listOf = (fact: string): string | null => {
    const d = FACT_DECLARATIONS[fact as FactKey];
    if (!d || d.answer !== ANSWER.CHOICE) return null;
    return d.list ?? null;
  };

  beforeAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    const rows = await prisma.productType.findMany({
      select: { key: true, facts: true, kinds: true, measures: true },
    });
    types = new Map(
      rows.map((row) => [
        row.key,
        {
          facts: row.facts,
          kinds: new Set((row.kinds as { key: string }[]).map((k) => k.key)),
          measures: new Set((row.measures as { key: string }[]).map((m) => m.key)),
        },
      ]),
    );
    const values = await prisma.listingValue.findMany({
      where: { orgId: null, retiredAt: null },
      select: { list: true, key: true },
    });
    permitted = new Set(values.map((v) => `${v.list}/${v.key}`));
  });

  it("seeded something to check — an empty catalogue passes everything", () => {
    expect(seedProducts.length).toBeGreaterThan(8);
    expect(seedProducts.filter((p) => p.facts).length).toBeGreaterThan(8);
  });

  it("points every category at a product type that exists", () => {
    for (const category of seedCategories) {
      if (!category.productType) continue;
      expect(types.has(category.productType), category.slug).toBe(true);
    }
  });

  it("gives every child category a parent that exists", () => {
    const ids = new Set(seedCategories.map((c) => c.id));
    for (const category of seedCategories) {
      if (!category.parentId) continue;
      expect(ids.has(category.parentId), category.slug).toBe(true);
    }
  });

  // The four rida categories share one type. That is the case worth having in dev: a browsing
  // category is not a question set, and nothing proves it like four of them asking the same thing.
  it("resolves every product to a type, children through their parent", () => {
    for (const product of seedProducts) {
      expect(typeOf(product.categoryId), product.slug).toBeDefined();
    }
    const ridas = seedProducts.filter((p) => typeOf(p.categoryId) === "islamic-wear");
    expect(new Set(ridas.map((p) => p.categoryId)).size).toBeGreaterThan(1);
  });

  it("answers only questions its type asks", () => {
    for (const product of seedProducts) {
      const type = types.get(typeOf(product.categoryId)!)!;
      for (const fact of Object.keys(product.facts ?? {})) {
        expect(type.facts, `${product.slug}: ${fact}`).toContain(fact);
      }
      for (const measure of Object.keys(product.measurements ?? {})) {
        expect(type.measures.has(measure), `${product.slug}: ${measure}`).toBe(true);
      }
    }
  });

  it("names only kinds its type declares", () => {
    for (const product of seedProducts) {
      if (!product.kind) continue;
      const type = types.get(typeOf(product.categoryId)!)!;
      expect(type.kinds.has(product.kind), `${product.slug}: ${product.kind}`).toBe(true);
    }
  });

  it("uses only values the vocabulary permits", () => {
    for (const product of seedProducts) {
      for (const [fact, value] of Object.entries(product.facts ?? {})) {
        const list = listOf(fact);
        if (list === null) continue; // free text or a number; nothing to check against
        expect(permitted.has(`${list}/${value}`), `${product.slug}: ${fact}=${value}`).toBe(true);
      }
    }
  });

  // Each of these makes a surface reachable in dev that an all-complete catalogue would hide.
  it("leaves the cases worth seeing reachable", () => {
    const facts = (slug: string) => seedProducts.find((p) => p.slug === slug)?.facts ?? {};
    // An answer Flipkart has no word for, so the register's worklist is not empty.
    expect(facts("maroon-nida-rida-semi-formal").material).toBe("nida");
    // A product the type's questions are only half answered on, so "incomplete" is reachable.
    expect(Object.keys(facts("cotton-rida-casual")).length).toBeLessThan(4);
    // A type decided against, so the "not sold here" list is not empty either.
    expect(typeOf(seedProducts.find((p) => p.slug === "ladies-masalla-bag-maroon")!.categoryId)).toBe(
      "combo",
    );
  });
});
