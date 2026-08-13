// The product form's schema is also the server's authority (Invariant 4), so a rule
// here is a rule in both places. These cases are the ones that actually broke: an
// optional field that rejected its own blank value, and a NaN from `valueAsNumber`
// that `.optional()` does not rescue. See CHANGELOG PR-22.
import { describe, expect, it } from "vitest";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import { categoryFormSchema } from "@/lib/validation/schemas/category.schema";

/** What the form sends when a user fills only the fields marked required. */
const filledForm = (overrides: Record<string, unknown> = {}) => ({
  name: "Cream Rida",
  description: "A lightweight cream rida.",
  price: 1200,
  salePrice: NaN, // an untouched number input, via valueAsNumber
  currency: "INR",
  categoryId: "cat_1",
  orgId: "sel_1",
  tags: [],
  flags: [],
  // A gallery is rows now, and the cover is a flag rather than images[0]; the gallery
  // rules themselves are pinned in product-media.test.ts.
  media: [
    { kind: "IMAGE", ref: "https://cdn.example.com/1.jpg", isThumbnail: true },
  ],
  weight: 0.5,
  sizes: [],
  colors: [],
  stockLocations: [{ orgAddressId: "loc_1", quantity: 5 }],
  sku: "",
  lowStockThreshold: 10,
  ...overrides,
});

const issuesFor = (input: unknown) => {
  const result = productFormSchema.safeParse(input);
  return (result.error?.issues ?? []).map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
};

describe("optional fields accept being left alone", () => {
  it("accepts the form exactly as it arrives with every optional field blank", () => {
    expect(issuesFor(filledForm())).toEqual([]);
  });

  it("treats a NaN from an untouched number input as absent, not invalid", () => {
    const parsed = productFormSchema.parse(filledForm({ salePrice: NaN }));
    expect(parsed.salePrice).toBeUndefined();
  });

  it("accepts a cleared low-stock threshold", () => {
    const parsed = productFormSchema.parse(filledForm({ lowStockThreshold: NaN }));
    expect(parsed.lowStockThreshold).toBeUndefined();
  });

  it("still enforces the rule when an optional number is filled in", () => {
    expect(issuesFor(filledForm({ salePrice: -5 }))).toEqual([
      { path: "salePrice", message: "Sale price must be greater than 0" },
    ]);
  });
});

describe("stock is per pickup location (stock-locations R2/A1)", () => {
  it("refuses a product with no location at all — an unchosen location is an error, not a default", () => {
    expect(issuesFor(filledForm({ stockLocations: [] }))).toContainEqual({
      path: "stockLocations",
      message: "Choose at least one pickup location",
    });
  });

  it("accepts all-zero quantities — sold out is a state a product has to be savable in", () => {
    expect(
      issuesFor(filledForm({ stockLocations: [{ orgAddressId: "loc_1", quantity: 0 }] }))
    ).toEqual([]);
  });

  it("refuses the same location twice", () => {
    expect(
      issuesFor(
        filledForm({
          stockLocations: [
            { orgAddressId: "loc_1", quantity: 2 },
            { orgAddressId: "loc_1", quantity: 3 },
          ],
        })
      )
    ).toEqual([{ path: "stockLocations", message: "Each location may appear only once" }]);
  });

  it("accepts a zero row beside a stocked one — the zero row is dropped on write", () => {
    expect(
      issuesFor(
        filledForm({
          stockLocations: [
            { orgAddressId: "loc_1", quantity: 0 },
            { orgAddressId: "loc_2", quantity: 13 },
          ],
        })
      )
    ).toEqual([]);
  });
});

describe("fields the form marks required are required in the schema", () => {
  it("rejects a zero weight, which shipping rates depend on", () => {
    expect(issuesFor(filledForm({ weight: 0 }))).toEqual([
      { path: "weight", message: "Weight must be greater than 0" },
    ]);
  });

  it("rejects a blank description, which the form has always demanded", () => {
    expect(issuesFor(filledForm({ description: "" }))).toEqual([
      { path: "description", message: "Description is required" },
    ]);
  });

  it("attributes a sale price above the regular price to the sale price field", () => {
    expect(issuesFor(filledForm({ salePrice: 2000 }))).toEqual([
      { path: "salePrice", message: "Sale price must be below the regular price" },
    ]);
  });
});

describe("the category form shares the optional-number fix", () => {
  it("accepts a cleared display order", () => {
    const parsed = categoryFormSchema.parse({ name: "Ridas", order: NaN });
    expect(parsed.order).toBeUndefined();
  });

  it("still rejects a fractional display order", () => {
    const result = categoryFormSchema.safeParse({ name: "Ridas", order: 1.5 });
    expect(result.error?.issues[0]?.message).toBe("Order must be a whole number");
  });
});
