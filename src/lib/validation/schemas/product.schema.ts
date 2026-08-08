import { z } from "zod";
import { optionalNumber, rupeeAmount } from "./common.schemas";
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
    // Required to match the form, which has always enforced it.
    description: z.string().trim().min(1, "Description is required").max(5000),

    // Rupees as typed; the service converts to paise at its boundary (server/shared/money).
    price: rupeeAmount("Price"),
    salePrice: optionalNumber(rupeeAmount("Sale price")),
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

    // Stock is per pickup location (stock-locations R2/R3): whoever adds a product
    // names where it sits and how many are there. An unchosen location is an error,
    // not a default.
    stockLocations: z
      .array(
        z.object({
          orgAddressId: z.string().min(1),
          quantity: z.number().int("Stock must be a whole number").min(0, "Stock cannot be negative"),
        })
      )
      .min(1, "Choose at least one pickup location")
      .refine((rows) => rows.some((row) => row.quantity > 0), {
        message: "Enter stock at at least one location",
      })
      .refine(
        (rows) => new Set(rows.map((row) => row.orgAddressId)).size === rows.length,
        { message: "Each location may appear only once" }
      ),
    sku: z.string().trim().max(64).optional(),
    lowStockThreshold: optionalNumber(z.number().int("Low stock threshold must be a whole number").min(0)),
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
  "orgId", "categoryId", "tags", "flags", "images", "thumbnail",
  "weight", "sizes", "colors", "stockLocations", "sku", "lowStockThreshold",
] as const;
