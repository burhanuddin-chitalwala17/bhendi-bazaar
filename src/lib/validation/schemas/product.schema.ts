import { z } from "zod";
import { optionalNumber, optionalPostalCodeSchema } from "./common.schemas";
import { ProductFlag } from "@server/catalog/product.flags";

/**
 * The three fields that override where a product ships from. A partial override is
 * meaningless — a city without a pincode still rates from the org's default — so
 * the group is all-or-none.
 */
export const SHIPPING_OVERRIDE_FIELDS = [
  "shippingFromPincode",
  "shippingFromCity",
  "shippingFromLocation",
] as const;

export const SHIPPING_OVERRIDE_MESSAGE =
  "Fill all three override fields, or clear them all to ship from the org's default address";

/**
 * The accepted shape of an admin product payload.
 *
 * Used by the route handler (server authority, Invariant 4) *and* as the form's
 * resolver, so the rules a user sees inline are the rules the server enforces.
 * `slug` is absent deliberately — it is server-generated and frozen.
 */
export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(255),
    // Required to match the form, which has always enforced it.
    description: z.string().trim().min(1, "Description is required").max(5000),

    price: z.number({ message: "Price is required" }).positive("Price must be greater than 0"),
    salePrice: optionalNumber(z.number().positive("Sale price must be greater than 0")),
    currency: z.string().length(3).optional(),

    orgId: z.string().min(1, "Organisation is required"),
    categoryId: z.string().min(1, "Category is required"),

    tags: z.array(z.string()).optional(),
    flags: z.array(z.enum(ProductFlag)).optional(),

    images: z.array(z.string()).min(1, "At least one image is required"),
    thumbnail: z.string().min(1, "A thumbnail is required"),

    weight: z.number({ message: "Weight is required" }).positive("Weight must be greater than 0"),

    sizes: z.array(z.string()).optional(),
    colors: z.array(z.string()).optional(),

    stock: z.number().int("Stock must be a whole number").min(0, "Stock cannot be negative"),
    sku: z.string().trim().max(64).optional(),
    lowStockThreshold: optionalNumber(z.number().int("Low stock threshold must be a whole number").min(0)),

    // Optional overrides — blank means "use the org's default", so blank must pass.
    shippingFromPincode: optionalPostalCodeSchema,
    shippingFromCity: z.string().trim().max(100).optional(),
    shippingFromLocation: z.string().trim().max(200).optional(),
  })
  // A cross-field rule neither side could enforce alone, attributed to the field a
  // user would correct.
  .refine((d) => d.salePrice === undefined || d.salePrice < d.price, {
    message: "Sale price must be below the regular price",
    path: ["salePrice"],
  })
  // All-or-none: blame every field left blank, so each one shows why it is needed.
  .superRefine((d, ctx) => {
    const filled = SHIPPING_OVERRIDE_FIELDS.filter((f) => (d[f] ?? "").trim() !== "");
    if (filled.length === 0 || filled.length === SHIPPING_OVERRIDE_FIELDS.length) return;

    for (const field of SHIPPING_OVERRIDE_FIELDS) {
      if ((d[field] ?? "").trim() === "") {
        ctx.addIssue({ code: "custom", path: [field], message: SHIPPING_OVERRIDE_MESSAGE });
      }
    }
  });

export type ProductFormSchemaInput = z.infer<typeof productFormSchema>;

/** Field names the product form owns, so server details can be routed to them. */
export const PRODUCT_FORM_FIELDS = [
  "name", "description", "price", "salePrice", "currency",
  "orgId", "categoryId", "tags", "flags", "images", "thumbnail",
  "weight", "sizes", "colors", "stock", "sku", "lowStockThreshold",
  ...SHIPPING_OVERRIDE_FIELDS,
] as const;
