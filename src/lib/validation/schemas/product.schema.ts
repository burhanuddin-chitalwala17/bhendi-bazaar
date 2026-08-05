import { z } from "zod";
import { postalCodeSchema } from "./common.schemas";
import { ProductFlag } from "@server/catalog/product.flags";

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
    description: z.string().max(5000).optional(),

    price: z.number({ message: "Price is required" }).positive("Price must be greater than 0"),
    salePrice: z.number().positive("Sale price must be greater than 0").optional(),
    currency: z.string().length(3).optional(),

    sellerId: z.string().min(1, "Seller is required"),
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
    lowStockThreshold: z.number().int().min(0).optional(),

    shippingFromPincode: postalCodeSchema,
    shippingFromCity: z.string().max(100).optional(),
    shippingFromLocation: z.string().max(200).optional(),
  })
  // A cross-field rule neither side could enforce alone, attributed to the field a
  // user would correct.
  .refine((d) => d.salePrice === undefined || d.salePrice < d.price, {
    message: "Sale price must be below the regular price",
    path: ["salePrice"],
  });

export type ProductFormSchemaInput = z.infer<typeof productFormSchema>;

/** Field names the product form owns, so server details can be routed to them. */
export const PRODUCT_FORM_FIELDS = [
  "name", "description", "price", "salePrice", "currency",
  "sellerId", "categoryId", "tags", "flags", "images", "thumbnail",
  "weight", "sizes", "colors", "stock", "sku", "lowStockThreshold",
  "shippingFromPincode", "shippingFromCity", "shippingFromLocation",
] as const;
