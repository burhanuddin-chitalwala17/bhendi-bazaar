import { z } from "zod";
import { optionalNumber, rupeeAmount } from "./common.schemas";
import { ProductFlag } from "@server/catalog/product.flags";
import { MEDIA_KINDS, MAX_MEDIA_PER_PRODUCT } from "@server/catalog/media";

/**
 * One gallery item. `ref` is already an id for YOUTUBE by the time it gets here — the
 * form parses the pasted link so the org member sees "that is not a YouTube link" inline
 * rather than after a round trip (ADR-0013).
 */
const productMediaSchema = z.object({
  kind: z.enum(MEDIA_KINDS),
  ref: z.string().trim().min(1, "Every gallery item needs a source").max(2048),
  description: z.string().trim().max(500).optional(),
  isThumbnail: z.boolean(),
});

/**
 * The gallery rules, all four of them, in the one place both sides read.
 *
 * Three are counts across items, so none is expressible as a database constraint and
 * all three live here (TRD D13, D13a, D16). The fourth — a cover is never a video — is
 * also a database check; it is repeated here so the org member gets a message instead of a
 * constraint violation.
 */
const productMediaListSchema = z
  .array(productMediaSchema)
  .min(1, "Add at least one photograph")
  .max(MAX_MEDIA_PER_PRODUCT, `A product can have at most ${MAX_MEDIA_PER_PRODUCT} gallery items`)
  .refine((media) => media.some((item) => item.kind === "IMAGE"), {
    message: "At least one photograph is required — video alone is not enough",
  })
  .refine((media) => media.filter((item) => item.isThumbnail).length === 1, {
    message: "Choose exactly one photograph as the cover",
  })
  .refine((media) => media.every((item) => !item.isThumbnail || item.kind === "IMAGE"), {
    message: "The cover must be a photograph, not a video",
  });

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

    // `thumbnail` is absent deliberately, like `slug`: it is derived from the cover and
    // owned by the server, so accepting it would be accepting a value we overwrite.
    media: productMediaListSchema,

    weight: z.number({ message: "Weight is required" }).positive("Weight must be greater than 0"),

    sizes: z.array(z.string()).optional(),
    colors: z.array(z.string()).optional(),

    // Stock is per pickup location (stock-locations R2/R3): whoever adds a product
    // names where it sits and how many are there. An unchosen location is an error,
    // not a default — but zero everywhere is legitimate: a sold-out product still
    // has to be editable, and a listing is often created before the stock arrives.
    stockLocations: z
      .array(
        z.object({
          orgAddressId: z.string().min(1),
          quantity: z.number().int("Stock must be a whole number").min(0, "Stock cannot be negative"),
        })
      )
      .min(1, "Choose at least one pickup location")
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
  "orgId", "categoryId", "tags", "flags", "media",
  "weight", "sizes", "colors", "stockLocations", "sku", "lowStockThreshold",
] as const;
