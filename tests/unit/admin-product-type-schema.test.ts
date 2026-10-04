import { describe, expect, it } from "vitest";

import {
  createProductTypeSchema,
  updateProductTypeSchema,
} from "@server/listing/admin.product-type.types";
import { FACTS, FACT_DECLARATIONS, PLATFORMS } from "@server/listing/listing-facts";

/**
 * What an admin may write ([product-types](../../docs/specs/listing-vocabulary/product-types/)
 * R1, R7). Creating a type is a design decision rather than data entry, so the rules enforced
 * here are about internal coherence: a type that asks nothing it varies on, or renames a
 * question it never asks, would render a form with fields that mean nothing.
 *
 * These are the same four checks the integration suite makes of the rows that shipped. There
 * they catch a bad migration; here they catch a bad admin, which is the case that starts
 * mattering the moment the screen exists.
 */
const valid = {
  key: "shoes",
  label: "Shoes",
  facts: ["colour", "material"],
  measures: [{ key: "length", label: "Length", unit: "cm", required: true }],
  variantAxis: ["colour"],
  kinds: [{ key: "sandal", label: "Sandal" }],
  factLabels: {},
  labelFrom: ["length"],
  labelScale: null,
  order: 0,
};

describe("a new type must be internally coherent", () => {
  it("accepts a coherent one", () => {
    expect(createProductTypeSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses varying on something it never asks about", () => {
    const parsed = createProductTypeSchema.safeParse({ ...valid, variantAxis: ["gemstone"] });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("vary on something it asks about");
  });

  it("accepts varying on a measurement, because an attar varies by its bottle", () => {
    expect(createProductTypeSchema.safeParse({ ...valid, variantAxis: ["length"] }).success).toBe(true);
  });

  it("refuses renaming a fact it does not ask", () => {
    const parsed = createProductTypeSchema.safeParse({
      ...valid,
      factLabels: { gemstone: "Stone" },
    });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("rename a fact it asks for");
  });

  it("accepts renaming a fact it does ask — cloth is asked its Fabric", () => {
    expect(
      createProductTypeSchema.safeParse({ ...valid, factLabels: { material: "Fabric" } }).success,
    ).toBe(true);
  });

  it("refuses reading a size label from a measurement it does not take", () => {
    const parsed = createProductTypeSchema.safeParse({ ...valid, labelFrom: ["diameter"] });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("measurement the type takes");
  });

  it("refuses asking the same fact twice", () => {
    expect(
      createProductTypeSchema.safeParse({ ...valid, facts: ["colour", "colour"] }).success,
    ).toBe(false);
  });

  it("refuses a fact the vocabulary does not declare", () => {
    expect(createProductTypeSchema.safeParse({ ...valid, facts: ["vibes"] }).success).toBe(false);
  });

  it("refuses a measure with a unit nobody declared", () => {
    expect(
      createProductTypeSchema.safeParse({
        ...valid,
        measures: [{ key: "length", label: "L", unit: "furlong", required: false }],
      }).success,
    ).toBe(false);
  });

  it("insists on at least one kind, because a kind is what a channel maps", () => {
    expect(createProductTypeSchema.safeParse({ ...valid, kinds: [] }).success).toBe(false);
  });

  it("refuses a malformed key, which products and categories would have to store", () => {
    for (const key of ["", "Shoes", "-shoes", "7shoes", "sho es", "shoes!"]) {
      expect(createProductTypeSchema.safeParse({ ...valid, key }).success, key).toBe(false);
    }
  });
});

describe("the update envelope", () => {
  // `key` is frozen after creation: products and categories store it, so renaming orphans them.
  it("does not accept a key at all", () => {
    const parsed = updateProductTypeSchema.parse({ label: "Renamed", key: "hijacked" } as never);
    expect("key" in parsed).toBe(false);
  });

  // zod v4: a default fires inside a PATCH and rewrites what the caller never mentioned.
  it("leaves every field absent when the caller does not mention it", () => {
    expect(Object.keys(updateProductTypeSchema.parse({ label: "Renamed" }))).toEqual(["label"]);
  });

  it("applies the same coherence rules as create", () => {
    expect(
      updateProductTypeSchema.safeParse({ facts: ["colour"], variantAxis: ["gemstone"] }).success,
    ).toBe(false);
  });

  it("accepts a lone field with nothing to be incoherent with", () => {
    expect(updateProductTypeSchema.safeParse({ order: 3 }).success).toBe(true);
  });
});

/**
 * R7: the screen names which marketplace will demand each fact. That claim is only worth making
 * if the data behind it is real and complete — it was measured from the templates, so every fact
 * must carry an answer, even an empty one.
 */
describe("every fact says which marketplaces demand it", () => {
  it("records a requirement list for every declared fact", () => {
    for (const fact of FACTS) {
      expect(FACT_DECLARATIONS[fact].requiredBy, fact).toBeDefined();
      expect(Array.isArray(FACT_DECLARATIONS[fact].requiredBy), fact).toBe(true);
    }
  });

  it("names only platforms that exist", () => {
    for (const fact of FACTS) {
      for (const platform of FACT_DECLARATIONS[fact].requiredBy) {
        expect(PLATFORMS, `${fact} names an unknown platform`).toContain(platform);
      }
    }
  });

  it("repeats no platform within one fact", () => {
    for (const fact of FACTS) {
      const list = FACT_DECLARATIONS[fact].requiredBy;
      expect(new Set(list).size, fact).toBe(list.length);
    }
  });

  // Spot-checks against the templates, so a careless edit to the data is caught.
  it("knows colour is demanded everywhere and care by nobody", () => {
    expect(FACT_DECLARATIONS.colour.requiredBy).toEqual(["amazon", "flipkart", "meesho"]);
    expect(FACT_DECLARATIONS.care.requiredBy).toEqual([]);
  });

  it("knows the Meesho-only garment questions", () => {
    for (const fact of ["sleeveLength", "sleeveStyling", "stitchType"] as const) {
      expect(FACT_DECLARATIONS[fact].requiredBy, fact).toEqual(["meesho"]);
    }
  });
});
