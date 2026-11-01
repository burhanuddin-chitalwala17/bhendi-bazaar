import { z } from "zod";
import { rupeeAmount } from "./common.schemas";

/**
 * A platform listing's own values (channel-listings D2). Only the six listing fields: strict fields
 * (MRP, barcode, HSN, brand, stock) are refused by `strict()`, never ignored (parent Q28). A field left
 * out is the product's. Limits here are generous; a marketplace's own limit warns on the screen (Q12).
 */
export const listingOverridesSchema = z
  .object({
    title: z.string().trim().min(1, "Write a title, or use the product's").max(500, "Keep the title to 500 characters").optional(),
    // Rupees as typed; the route converts to paise (Invariant 3).
    price: rupeeAmount("Price").optional(),
    photos: z.array(z.string().min(1).max(64)).min(1, "Keep at least one photo").max(20).optional(),
    features: z
      .array(z.string().trim().min(1, "Write the point, or remove it").max(1000, "Keep each point to 1,000 characters"))
      .max(5, "Up to five points")
      .optional(),
    description: z.string().trim().min(1, "Write a description, or use the product's").max(5000, "Keep the description to 5,000 characters").optional(),
    listed: z.boolean().optional(),
  })
  .strict();

export const listingSaveSchema = z
  .object({
    seenVersion: z.number().int().min(0),
    overrides: listingOverridesSchema,
  })
  .strict();
export type ListingSaveInput = z.input<typeof listingSaveSchema>;
export type ListingOverridesInput = z.input<typeof listingOverridesSchema>;

/** Publish what was reviewed (marketplace-publish D3): each listing at the version shown, with the fields kept. */
export const listingPublishSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        version: z.number().int().min(0),
        fields: z.array(z.enum(["title", "price", "photos", "features", "description", "listed"])).max(6),
      }),
    )
    .min(1)
    .max(200),
});
export type ListingPublishInput = z.input<typeof listingPublishSchema>;

/** Start a listing for a product not yet on the marketplace (marketplace-publish Q7). */
export const listingDraftSchema = z
  .object({ mode: z.enum(["offer", "new"]), targetExternalId: z.string().trim().min(1).max(20).nullable().default(null) })
  .refine((d) => d.mode === "new" || d.targetExternalId !== null, "Pick the page to sell on.");
export type ListingDraftInput = z.input<typeof listingDraftSchema>;
