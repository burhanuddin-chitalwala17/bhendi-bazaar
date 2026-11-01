import { describe, expect, it } from "vitest";

import { PRODUCT_FORM_FIELDS, productFormSchema } from "@/lib/validation/schemas/product.schema";

/**
 * What a product form may send about the listing vocabulary
 * ([listing-vocabulary](../../docs/specs/listing-vocabulary/)).
 *
 * The rule worth a test is what is **absent**. `productType` is resolved from the category tree
 * on save, and the answers are stored with the level that supplied each — so a payload that
 * could set either could claim a shop typed something it inherited, or put a product under a
 * type its category does not use. Both are Invariant 4's "server-owned fields are never accepted
 * as input", and both typecheck if nobody checks.
 */
const base = {
  name: "Black Rida",
  description: "A black rida in nida matte",
  price: 250000,
  orgId: "org_1",
  categoryId: "cat_1",
  media: [{ kind: "IMAGE" as const, ref: "products/black-rida.jpg", isThumbnail: true }],
  weight: 0.6,
  stockLocations: [{ orgAddressId: "addr_1", quantity: 1 }],
};

describe("what a product may say about its listing facts", () => {
  it("accepts bare answers for facts and measurements", () => {
    const parsed = productFormSchema.parse({
      ...base,
      facts: { colour: "black", material: "nida-matte", waterResistant: false },
      measurements: { length: 54, bust: 44 },
    });
    expect(parsed.facts?.colour).toBe("black");
    expect(parsed.measurements?.length).toBe(54);
  });

  it("accepts a kind, a family and a brand", () => {
    const parsed = productFormSchema.parse({
      ...base,
      kind: "rida",
      familyId: "fam_1",
      brandId: "brand_1",
    });
    expect(parsed.kind).toBe("rida");
    expect(parsed.familyId).toBe("fam_1");
  });

  it("accepts them all being absent, because nothing here blocks saving", () => {
    const parsed = productFormSchema.parse(base);
    expect(parsed.facts).toBeUndefined();
    expect(parsed.kind).toBeUndefined();
  });

  it("accepts null to clear a kind, a family or a brand", () => {
    const parsed = productFormSchema.parse({ ...base, kind: null, familyId: null, brandId: null });
    expect(parsed.kind).toBeNull();
  });
});

describe("what a product may never say", () => {
  // Resolved from the category tree on save (categories D1b). Accepting it would let a payload
  // put a product under a type its category does not use.
  it("drops a productType it was sent", () => {
    const parsed = productFormSchema.parse({ ...base, productType: "jewellery" } as never);
    expect("productType" in parsed).toBe(false);
  });

  // Origin is the server's word for where a value came from. A request that could set it could
  // claim a shop typed something it inherited — which is what the brand-level correction skips.
  it("does not accept the stored shape, where an answer carries its own origin", () => {
    const parsed = productFormSchema.safeParse({
      ...base,
      facts: { colour: { value: "black", origin: "product" } },
    } as never);
    expect(parsed.success).toBe(false);
  });

  it("still drops slug and thumbnail, which were already server-owned", () => {
    const parsed = productFormSchema.parse({
      ...base,
      slug: "hijacked",
      thumbnail: "hijacked.jpg",
    } as never);
    expect("slug" in parsed).toBe(false);
    expect("thumbnail" in parsed).toBe(false);
  });

  it("refuses a measurement that is not a number", () => {
    expect(
      productFormSchema.safeParse({ ...base, measurements: { length: "54 inches" } } as never)
        .success,
    ).toBe(false);
  });
});

describe("the form's field list stays in step with the schema", () => {
  // Server-side details are routed to a field by name; one missing here lands nowhere and the
  // form shows no error against the input the person has to correct (ADR-0013).
  it("names every new vocabulary field", () => {
    for (const field of ["kind", "familyId", "brandId", "facts", "measurements"]) {
      expect(PRODUCT_FORM_FIELDS, field).toContain(field);
    }
  });

  it("names no field the schema does not accept", () => {
    const accepted = Object.keys(productFormSchema.parse(base));
    const optional = ["description", "salePrice", "currency", "tags", "flags", "sizes", "colors",
      "sku", "lowStockThreshold", "kind", "familyId", "brandId", "facts", "measurements", "mrp", "barcode", "keyFeatures"];
    for (const field of PRODUCT_FORM_FIELDS) {
      expect(
        accepted.includes(field) || optional.includes(field),
        `${field} is routed to but never parsed`,
      ).toBe(true);
    }
  });
});
