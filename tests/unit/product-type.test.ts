import { describe, expect, it } from "vitest";

import {
  holdsKind,
  kindsOf,
  parseProductTypeKey,
  productTypeSchemaFor,
  resolveProductType,
  type ProductTypeSource,
} from "@server/listing/product-type";
import {
  parseProductTypeRecord,
  labelForFact,
  type ProductTypeRecord,
} from "@server/listing/product-type.types";

/**
 * The types are rows now, so what stays here is what stays pure: the tree walk, the key parsing,
 * and the schema factory. The integrity of a stored row — that it names only facts that exist,
 * and varies only on what it asks about — is checked against a real database in
 * `tests/integration/product-type-table.test.ts`, because that is where a bad row can appear.
 */
const record = (over: Partial<ProductTypeRecord> = {}): ProductTypeRecord => ({
  key: "islamic-wear",
  label: "Islamic wear",
  facts: ["colour", "material"],
  measures: [{ key: "length", label: "Length", unit: "in", required: true }],
  variantAxis: ["colour"],
  kinds: [
    { key: "abaya", label: "Abaya" },
    { key: "rida", label: "Rida" },
  ],
  factLabels: { material: "Fabric" },
  labelFrom: ["length"],
  labelScale: null,
  ...over,
});

describe("resolving a product type up the category tree", () => {
  const tree: ProductTypeSource[] = [
    { id: "root", parentId: null, productType: "islamic-wear" },
    { id: "child", parentId: "root", productType: null },
    { id: "grandchild", parentId: "child", productType: null },
    { id: "own", parentId: "root", productType: "bag" },
    { id: "orphan", parentId: null, productType: null },
  ];

  it("takes a category's own type when it has one", () => {
    expect(resolveProductType("own", tree)).toBe("bag");
  });

  it("inherits from the nearest ancestor that sets one", () => {
    expect(resolveProductType("grandchild", tree)).toBe("islamic-wear");
  });

  it("returns null when nothing in the tree declares one", () => {
    expect(resolveProductType("orphan", tree)).toBeNull();
  });

  it("returns null for an unknown or absent category rather than guessing", () => {
    expect(resolveProductType("missing", tree)).toBeNull();
    expect(resolveProductType(null, tree)).toBeNull();
    expect(resolveProductType(undefined, tree)).toBeNull();
  });

  it("ignores a stored value that is not shaped like a key", () => {
    expect(resolveProductType("a", [{ id: "a", parentId: null, productType: "NOT A KEY" }])).toBeNull();
    expect(resolveProductType("a", [{ id: "a", parentId: null, productType: 7 }])).toBeNull();
  });

  // A self-referencing tree can hold a cycle; the walk must end rather than hang the request.
  it("terminates on a cycle", () => {
    expect(
      resolveProductType("a", [
        { id: "a", parentId: "b", productType: null },
        { id: "b", parentId: "a", productType: null },
      ]),
    ).toBeNull();
  });

  it("finds a type beyond a cycle it has already walked", () => {
    expect(
      resolveProductType("a", [
        { id: "a", parentId: "b", productType: null },
        { id: "b", parentId: "c", productType: null },
        { id: "c", parentId: "b", productType: "socks" },
      ]),
    ).toBe("socks");
  });
});

describe("the schema is built from the keys that exist", () => {
  const schema = productTypeSchemaFor(["islamic-wear", "bag"]);

  it("accepts a key the caller offered", () => {
    expect(schema.parse("bag")).toBe("bag");
  });

  it("reads an unselected dropdown as inheriting", () => {
    expect(schema.parse("")).toBeNull();
    expect(schema.parse(null)).toBeNull();
  });

  it("refuses a key the caller did not offer", () => {
    for (const bad of ["socks", "BAG", "bags", " bag "]) {
      const parsed = schema.safeParse(bad);
      expect(parsed.success, bad).toBe(bad === " bag ");
    }
  });

  // Widening the offered set widens what is accepted — which is the whole point of a factory.
  it("accepts a key once it exists", () => {
    expect(productTypeSchemaFor(["socks"]).safeParse("socks").success).toBe(true);
    expect(productTypeSchemaFor([]).safeParse("socks").success).toBe(false);
  });
});

describe("reading a stored key", () => {
  it("accepts a well-shaped key and refuses anything else", () => {
    expect(parseProductTypeKey("islamic-wear")).toBe("islamic-wear");
    for (const bad of ["", "Islamic-Wear", "-leading", "7up", 7, null, undefined, {}]) {
      expect(parseProductTypeKey(bad)).toBeNull();
    }
  });
});

describe("reading a stored row", () => {
  it("parses a well-formed record", () => {
    expect(parseProductTypeRecord(record())?.key).toBe("islamic-wear");
  });

  it("reads a malformed row as no type rather than throwing", () => {
    expect(parseProductTypeRecord(null)).toBeNull();
    expect(parseProductTypeRecord({ key: "x" })).toBeNull();
    expect(parseProductTypeRecord(record({ facts: ["not-a-fact"] as never }))).toBeNull();
    expect(parseProductTypeRecord(record({ measures: [{ key: "nope" }] as never }))).toBeNull();
  });

  it("refuses a measure with a unit nobody declared", () => {
    expect(
      parseProductTypeRecord(
        record({ measures: [{ key: "length", label: "L", unit: "furlong", required: false }] as never }),
      ),
    ).toBeNull();
  });
});

describe("a type's own wording and its kinds", () => {
  it("calls material 'Fabric' where the type says so, and 'Material' where it does not", () => {
    expect(labelForFact(record(), "material", "Material")).toBe("Fabric");
    expect(labelForFact(record({ factLabels: {} }), "material", "Material")).toBe("Material");
  });

  it("offers the kinds it holds", () => {
    expect(kindsOf(record()).map((k) => k.key)).toEqual(["abaya", "rida"]);
    expect(kindsOf(null)).toEqual([]);
  });

  it("recognises a kind it holds and refuses one it does not", () => {
    expect(holdsKind(record(), "rida")).toBe(true);
    expect(holdsKind(record(), "trouser")).toBe(false);
    expect(holdsKind(null, "rida")).toBe(false);
  });

  // A product with no kind is legitimate — the type may not need one to publish.
  it("treats an absent kind as acceptable", () => {
    expect(holdsKind(record(), null)).toBe(true);
    expect(holdsKind(record(), undefined)).toBe(true);
  });
});
