/**
 * What a team save records (product-form D11, Q13, Q21, Q22; spec R11): money first, then stock,
 * then the rest — and a team save without a reason never reaches the server.
 */
import { describe, expect, it } from "vitest";
import { answersOf, teamChanges, type TeamSnapshot } from "@server/catalog/product-team";
import { parseStoredFacts } from "@server/listing/listing-facts";
import { TEAM_REASON_REQUIRED, teamProductEditSchema } from "@/lib/validation/schemas/product.schema";

const base: TeamSnapshot = {
  price: 249_900,
  salePrice: null,
  stock: { "Main shop": 5 },
  name: "Emerald Abaya",
  description: "Soft crepe",
  category: "Abayas",
  sku: "EA-1",
  weight: 0.6,
  lowStockThreshold: 10,
  tags: ["eid"],
  flags: [],
  kind: null,
  familyId: null,
  brandId: null,
  facts: { fabric: "crepe" },
  measurements: {},
  media: ["https://img/1.jpg"],
};

describe("team changes (spec R11, Q21)", () => {
  it("lists money before stock before everything else, in paise", () => {
    const after = { ...base, name: "Emerald Abaya (L)", stock: { "Main shop": 3 }, salePrice: 229_900, price: 259_900 };
    expect(teamChanges(base, after)).toEqual([
      { field: "price", before: 249_900, after: 259_900 },
      { field: "salePrice", before: null, after: 229_900 },
      { field: "stock", at: "Main shop", before: 5, after: 3 },
      { field: "name", before: "Emerald Abaya", after: "Emerald Abaya (L)" },
    ]);
  });

  it("names each fact that moved, and nothing that did not", () => {
    const after = { ...base, facts: { fabric: "silk", colour: "green" } };
    expect(teamChanges(base, after)).toEqual([
      { field: "facts", at: "colour", before: null, after: "green" },
      { field: "facts", at: "fabric", before: "crepe", after: "silk" },
    ]);
    expect(teamChanges(base, { ...base })).toEqual([]);
  });

  it("a create lists every filled field against nothing, and no blank one", () => {
    const changes = teamChanges(null, { ...base, sku: null, description: "" });
    expect(changes[0]).toEqual({ field: "price", before: null, after: 249_900 });
    expect(changes.map((change) => change.field)).not.toContain("sku");
    expect(changes.map((change) => change.field)).not.toContain("description");
  });
});

describe("a team save needs a reason (Q22)", () => {
  const edit = {
    name: "Emerald Abaya",
    description: "Soft crepe",
    price: 2499,
    categoryId: "cat-1",
    weight: 0.6,
    media: [{ kind: "IMAGE", ref: "https://placehold.co/600x600", isThumbnail: true }],
    stockLocations: [{ orgAddressId: "loc-1", quantity: 5 }],
    seenVersion: 0,
  };

  it.each([undefined, "", "  ", "ok"])("refuses %j with the copy the shop's team reads", (reason) => {
    const result = teamProductEditSchema.safeParse({ ...edit, reason });
    expect(result.success).toBe(false);
    expect(result.error?.issues.find((issue) => issue.path[0] === "reason")?.message).toBe(TEAM_REASON_REQUIRED);
  });

  it("takes a one-line reason, trimmed", () => {
    const result = teamProductEditSchema.safeParse({ ...edit, reason: "  Shop asked to fix the price " });
    expect(result.success && result.data.reason).toBe("Shop asked to fix the price");
  });
});

describe("stored answers are parsed before they are compared (ADR-0051)", () => {
  it("reads parsed answers as their values", () => {
    expect(answersOf(parseStoredFacts({ material: { value: "crepe", origin: "product" } }))).toEqual({ material: "crepe" });
  });

  it("reads a legacy bare value as no answer, never as a fake change", () => {
    expect(answersOf(parseStoredFacts({ material: "crepe" }))).toEqual({});
  });
});
