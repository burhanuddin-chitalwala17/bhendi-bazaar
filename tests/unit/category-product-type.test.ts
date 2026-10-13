import { describe, expect, it } from "vitest";

import {
  categoryFormSchemaFor,
  updateCategorySchemaFor,
} from "@/lib/validation/schemas/category.schema";
/**
 * The valid types are rows now, so the schema is a factory and these are the keys a caller
 * handed it — the form from its options, the route from the database (product-types D6).
 */
const PRODUCT_TYPES = ["islamic-wear", "trousers", "bag", "fragrance", "jewellery"] as const;
const PRODUCT_TYPE = { FRAGRANCE: "fragrance" } as const;
const categoryFormSchema = categoryFormSchemaFor(PRODUCT_TYPES);
const updateCategorySchema = updateCategorySchemaFor(PRODUCT_TYPES);

/**
 * A category says which listing questions its products are asked
 * (listing-vocabulary/categories R1a, D1a). The schema is both the form's resolver and what the
 * route parses, so what a shop is shown inline is what the server enforces
 * ([ADR-0013](../../docs/adr/0013-one-error-envelope-and-useserverform.md)).
 */
const base = { name: "Abayas", description: "Modest wear" };

describe("a category's product type on the create payload", () => {
  it("accepts each of the nine", () => {
    for (const type of PRODUCT_TYPES) {
      const parsed = categoryFormSchema.parse({ ...base, productType: type });
      expect(parsed.productType).toBe(type);
    }
  });

  it("reads an unselected dropdown as inheriting, not as a value", () => {
    expect(categoryFormSchema.parse({ ...base, productType: "" }).productType).toBeNull();
    expect(categoryFormSchema.parse({ ...base, productType: null }).productType).toBeNull();
  });

  it("defaults to inheriting when the field is absent entirely", () => {
    expect(categoryFormSchema.parse(base).productType).toBeNull();
  });

  it("refuses a type the caller did not offer, rather than storing it", () => {
    for (const bad of ["islamicwear", "ISLAMIC-WEAR", "abaya", "other", "socks"]) {
      expect(categoryFormSchema.safeParse({ ...base, productType: bad }).success).toBe(false);
    }
  });

  it("refuses a non-string", () => {
    expect(categoryFormSchema.safeParse({ ...base, productType: 7 }).success).toBe(false);
    expect(categoryFormSchema.safeParse({ ...base, productType: {} }).success).toBe(false);
  });
});

describe("a category's product type on the update payload", () => {
  // `.partial()` does not strip a `.default()` in zod v4, so a defaulted field fires inside a
  // PATCH and rewrites what the caller never mentioned. The update envelope must stay optional.
  it("stays absent when the caller does not mention it", () => {
    const parsed = updateCategorySchema.parse({ name: "Renamed" });
    expect("productType" in parsed).toBe(false);
  });

  it("clears the type when the caller sends an empty selection", () => {
    expect(updateCategorySchema.parse({ productType: "" }).productType).toBeNull();
    expect(updateCategorySchema.parse({ productType: null }).productType).toBeNull();
  });

  it("sets a type the caller names", () => {
    expect(updateCategorySchema.parse({ productType: PRODUCT_TYPE.FRAGRANCE }).productType).toBe(
      PRODUCT_TYPE.FRAGRANCE,
    );
  });

  it("refuses an unoffered type on update too", () => {
    expect(updateCategorySchema.safeParse({ productType: "perfume" }).success).toBe(false);
  });

  // The form and the route build from the same function, so a type one accepts the other does.
  it("accepts a type once the caller offers it", () => {
    expect(updateCategorySchemaFor(["socks"]).safeParse({ productType: "socks" }).success).toBe(true);
    expect(updateCategorySchemaFor([]).safeParse({ productType: "socks" }).success).toBe(false);
  });
});

describe("the two envelopes stay symmetric", () => {
  // Invariant 4: an update that whitelists less than its create is how a field becomes
  // unsettable, and one that whitelists more is how mass assignment happens.
  it("accepts the same product types on create and on update", () => {
    for (const type of PRODUCT_TYPES) {
      expect(categoryFormSchema.safeParse({ ...base, productType: type }).success).toBe(true);
      expect(updateCategorySchema.safeParse({ productType: type }).success).toBe(true);
    }
  });

  it("refuses the same rubbish on both", () => {
    expect(categoryFormSchema.safeParse({ ...base, productType: "nope" }).success).toBe(false);
    expect(updateCategorySchema.safeParse({ productType: "nope" }).success).toBe(false);
  });

  it("still refuses a slug on either, which stays server-generated", () => {
    const created = categoryFormSchema.parse({ ...base, slug: "hijacked" } as never);
    expect("slug" in created).toBe(false);
    const updated = updateCategorySchema.parse({ slug: "hijacked" } as never);
    expect("slug" in updated).toBe(false);
  });
});
