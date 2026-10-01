import { describe, expect, it } from "vitest";

import {
  FACTS,
  FACT_DECLARATIONS,
  LISTS,
  MEASURES,
  UNITS,
  parseStoredFacts,
  storedFactsSchema,
} from "@server/catalog/listing-facts";
import {
  PRODUCT_TYPES,
  PRODUCT_TYPE,
  PRODUCT_TYPE_DECLARATIONS,
  declarationFor,
  labelForFact,
  parseProductType,
  resolveProductType,
  type ProductTypeSource,
} from "@server/catalog/product-type";

/**
 * The declaration is what renders the form, validates the write and answers readiness
 * (categories D2), so a declaration naming a fact that does not exist is a form field with no
 * meaning. These are the checks that stop the three drifting apart.
 */
describe("the product type declarations are internally consistent", () => {
  it("declares every type exactly once, keyed by itself", () => {
    expect(Object.keys(PRODUCT_TYPE_DECLARATIONS).sort()).toEqual([...PRODUCT_TYPES].sort());
    for (const key of PRODUCT_TYPES) {
      expect(PRODUCT_TYPE_DECLARATIONS[key].key).toBe(key);
    }
  });

  it("names only facts that exist", () => {
    for (const type of Object.values(PRODUCT_TYPE_DECLARATIONS)) {
      for (const fact of type.facts) {
        expect(FACTS, `${type.key} asks for an unknown fact "${fact}"`).toContain(fact);
      }
    }
  });

  it("names only measures and units that exist", () => {
    for (const type of Object.values(PRODUCT_TYPE_DECLARATIONS)) {
      for (const m of type.measures) {
        expect(MEASURES, `${type.key} measures an unknown "${m.key}"`).toContain(m.key);
        expect(UNITS, `${type.key}.${m.key} uses an unknown unit`).toContain(m.unit);
      }
    }
  });

  it("varies only on something it actually asks about", () => {
    for (const type of Object.values(PRODUCT_TYPE_DECLARATIONS)) {
      const asked = new Set<string>([...type.facts, ...type.measures.map((m) => m.key)]);
      for (const axis of type.variantAxis) {
        expect(asked, `${type.key} varies on "${axis}" but never asks for it`).toContain(axis);
      }
    }
  });

  it("relabels only facts it asks for", () => {
    for (const type of Object.values(PRODUCT_TYPE_DECLARATIONS)) {
      for (const fact of Object.keys(type.labels ?? {})) {
        expect(type.facts, `${type.key} relabels "${fact}" without asking it`).toContain(fact);
      }
    }
  });

  it("gives every type at least one kind, with unique keys", () => {
    for (const type of Object.values(PRODUCT_TYPE_DECLARATIONS)) {
      expect(type.kinds.length, `${type.key} holds no kinds`).toBeGreaterThan(0);
      const keys = type.kinds.map((k) => k.key);
      expect(new Set(keys).size, `${type.key} repeats a kind key`).toBe(keys.length);
    }
  });

  it("asks no fact twice, and no measure twice", () => {
    for (const type of Object.values(PRODUCT_TYPE_DECLARATIONS)) {
      expect(new Set(type.facts).size, `${type.key} asks a fact twice`).toBe(type.facts.length);
      const measures = type.measures.map((m) => m.key);
      expect(new Set(measures).size, `${type.key} measures one thing twice`).toBe(measures.length);
    }
  });

  it("points every choice fact at a list that exists", () => {
    for (const declaration of Object.values(FACT_DECLARATIONS)) {
      if (declaration.answer !== "choice") continue;
      expect(declaration.list, `${declaration.key} is a choice with no list`).toBeDefined();
      expect(LISTS, `${declaration.key} draws on an unknown list`).toContain(declaration.list);
    }
  });

  it("declares every fact exactly once, keyed by itself", () => {
    expect(Object.keys(FACT_DECLARATIONS).sort()).toEqual([...FACTS].sort());
    for (const key of FACTS) expect(FACT_DECLARATIONS[key].key).toBe(key);
  });
});

/** What the templates settled, asserted so a later edit cannot quietly undo it. */
describe("the declarations match what the platform templates ask for", () => {
  it("separates attar from bakhoor, because every platform does", () => {
    const kinds = declarationFor(PRODUCT_TYPE.FRAGRANCE).kinds.map((k) => k.key);
    expect(kinds).toContain("attar");
    expect(kinds).toContain("bakhoor");
  });

  it("varies fragrance by capacity, not colour", () => {
    expect(declarationFor(PRODUCT_TYPE.FRAGRANCE).variantAxis).toEqual(["capacity"]);
  });

  it("requires bust and length on Islamic wear, which Meesho makes compulsory", () => {
    const required = declarationFor(PRODUCT_TYPE.ISLAMIC_WEAR)
      .measures.filter((m) => m.required)
      .map((m) => m.key);
    expect(required).toContain("bust");
    expect(required).toContain("length");
  });

  it("requires real dimensions on a prayer mat, which free size does not excuse", () => {
    const required = declarationFor(PRODUCT_TYPE.PRAYER_MAT)
      .measures.filter((m) => m.required)
      .map((m) => m.key);
    expect(required).toEqual(["length", "width"]);
  });

  it("asks no type to vary by a size label, because nothing in this store has sizes", () => {
    for (const type of Object.values(PRODUCT_TYPE_DECLARATIONS)) {
      expect(type.variantAxis as readonly string[]).not.toContain("size");
    }
  });

  it("calls material 'Fabric' where the trade does and 'Material' where it does not", () => {
    const garment = declarationFor(PRODUCT_TYPE.ISLAMIC_WEAR);
    const bag = declarationFor(PRODUCT_TYPE.BAG);
    expect(labelForFact(garment, "material", "Material")).toBe("Fabric");
    expect(labelForFact(bag, "material", "Material")).toBe("Material");
  });
});

describe("resolving a product type up the category tree", () => {
  const tree: ProductTypeSource[] = [
    { id: "root", parentId: null, productType: PRODUCT_TYPE.ISLAMIC_WEAR },
    { id: "child", parentId: "root", productType: null },
    { id: "grandchild", parentId: "child", productType: null },
    { id: "own", parentId: "root", productType: PRODUCT_TYPE.BAG },
    { id: "orphan", parentId: null, productType: null },
  ];

  it("takes a category's own type when it has one", () => {
    expect(resolveProductType("own", tree)).toBe(PRODUCT_TYPE.BAG);
  });

  it("inherits from the nearest ancestor that sets one", () => {
    expect(resolveProductType("grandchild", tree)).toBe(PRODUCT_TYPE.ISLAMIC_WEAR);
  });

  it("returns null when nothing in the tree declares one", () => {
    expect(resolveProductType("orphan", tree)).toBeNull();
  });

  it("returns null for an unknown or absent category rather than guessing", () => {
    expect(resolveProductType("missing", tree)).toBeNull();
    expect(resolveProductType(null, tree)).toBeNull();
    expect(resolveProductType(undefined, tree)).toBeNull();
  });

  it("ignores a stored value that is not a product type", () => {
    expect(resolveProductType("a", [{ id: "a", parentId: null, productType: "not-a-type" }])).toBeNull();
  });

  // A self-referencing tree can hold a cycle; the walk must end rather than hang the request.
  it("terminates on a cycle", () => {
    const cyclic: ProductTypeSource[] = [
      { id: "a", parentId: "b", productType: null },
      { id: "b", parentId: "a", productType: null },
    ];
    expect(resolveProductType("a", cyclic)).toBeNull();
  });

  it("finds a type beyond a cycle it has already walked", () => {
    const cyclic: ProductTypeSource[] = [
      { id: "a", parentId: "b", productType: null },
      { id: "b", parentId: "c", productType: null },
      { id: "c", parentId: "b", productType: PRODUCT_TYPE.SOCKS },
    ];
    expect(resolveProductType("a", cyclic)).toBe(PRODUCT_TYPE.SOCKS);
  });
});

describe("reading a stored type and stored facts", () => {
  it("accepts a known type and refuses anything else", () => {
    expect(parseProductType(PRODUCT_TYPE.SOCKS)).toBe(PRODUCT_TYPE.SOCKS);
    for (const bad of ["", "socks ", "SOCKS", 7, null, undefined, {}]) {
      expect(parseProductType(bad)).toBeNull();
    }
  });

  it("keeps a stored fact together with the level that supplied it", () => {
    const parsed = storedFactsSchema.parse({
      colour: { value: "black", origin: "product" },
      material: { value: "nida-matte", origin: "brand" },
    });
    expect(parsed.material?.origin).toBe("brand");
  });

  it("marks an answer that matched no permitted value rather than discarding it", () => {
    const parsed = storedFactsSchema.parse({ colour: { value: "Marron", origin: "product", unlisted: true } });
    expect(parsed.colour?.unlisted).toBe(true);
  });

  it("reads a corrupt or absent tail as no facts rather than throwing", () => {
    expect(parseStoredFacts(null)).toEqual({});
    expect(parseStoredFacts(undefined)).toEqual({});
    expect(parseStoredFacts("nonsense")).toEqual({});
    expect(parseStoredFacts({ colour: { value: "black" } })).toEqual({});
  });

  it("refuses a fact key the vocabulary does not declare", () => {
    expect(storedFactsSchema.safeParse({ nope: { value: "x", origin: "product" } }).success).toBe(false);
  });

  it("refuses an origin that is not a level", () => {
    expect(storedFactsSchema.safeParse({ colour: { value: "x", origin: "guess" } }).success).toBe(false);
  });
});
