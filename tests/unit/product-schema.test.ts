// The product form's schema is also the server's authority (Invariant 4), so a rule
// here is a rule in both places. These cases are the ones that actually broke: an
// optional field that rejected its own blank value, and a NaN from `valueAsNumber`
// that `.optional()` does not rescue. See CHANGELOG PR-22.
import { describe, expect, it } from "vitest";
import {
  productFormSchema,
  SHIPPING_OVERRIDE_MESSAGE,
} from "@/lib/validation/schemas/product.schema";
import { categoryFormSchema } from "@/lib/validation/schemas/category.schema";
import { PINCODE_MESSAGE } from "@server/shared/pincode";

/** What the form sends when a user fills only the fields marked required. */
const filledForm = (overrides: Record<string, unknown> = {}) => ({
  name: "Cream Rida",
  description: "A lightweight cream rida.",
  price: 1200,
  salePrice: NaN, // an untouched number input, via valueAsNumber
  currency: "INR",
  categoryId: "cat_1",
  sellerId: "sel_1",
  tags: [],
  flags: [],
  images: ["https://cdn.example.com/1.jpg"],
  thumbnail: "https://cdn.example.com/1.jpg",
  weight: 0.5,
  sizes: [],
  colors: [],
  stock: 5,
  sku: "",
  lowStockThreshold: 10,
  shippingFromPincode: "",
  shippingFromCity: "",
  shippingFromLocation: "",
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

  it("accepts a blank shipping pincode, which means 'use the seller default'", () => {
    expect(issuesFor(filledForm({ shippingFromPincode: "" }))).toEqual([]);
  });

  it("still enforces the rule when an optional number is filled in", () => {
    expect(issuesFor(filledForm({ salePrice: -5 }))).toEqual([
      { path: "salePrice", message: "Sale price must be greater than 0" },
    ]);
  });
});

describe("the shipping override group is all-or-none", () => {
  it("passes when all three are blank", () => {
    expect(issuesFor(filledForm())).toEqual([]);
  });

  it("passes when all three are filled", () => {
    expect(
      issuesFor(
        filledForm({
          shippingFromPincode: "400003",
          shippingFromCity: "Mumbai",
          shippingFromLocation: "Warehouse 2",
        })
      )
    ).toEqual([]);
  });

  it("blames each blank field when only the pincode is given", () => {
    expect(issuesFor(filledForm({ shippingFromPincode: "400003" }))).toEqual([
      { path: "shippingFromCity", message: SHIPPING_OVERRIDE_MESSAGE },
      { path: "shippingFromLocation", message: SHIPPING_OVERRIDE_MESSAGE },
    ]);
  });

  it("blames each blank field when only the city is given", () => {
    expect(issuesFor(filledForm({ shippingFromCity: "Mumbai" }))).toEqual([
      { path: "shippingFromPincode", message: SHIPPING_OVERRIDE_MESSAGE },
      { path: "shippingFromLocation", message: SHIPPING_OVERRIDE_MESSAGE },
    ]);
  });

  it("treats whitespace as blank rather than as a filled field", () => {
    expect(issuesFor(filledForm({ shippingFromCity: "   " }))).toEqual([]);
  });

  it("reports the pincode format, not the group rule, when the group is complete", () => {
    expect(
      issuesFor(
        filledForm({
          shippingFromPincode: "12",
          shippingFromCity: "Mumbai",
          shippingFromLocation: "Warehouse 2",
        })
      )
    ).toEqual([{ path: "shippingFromPincode", message: PINCODE_MESSAGE }]);
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
