import { z } from "zod";

/**
 * Settling marketplace listings (product-merge D10): add them as one new product, or match them to
 * one the shop has. The body names listings and sides, never a photo address: the photos are read
 * from the marketplace on the server (D2, D6). The price is in rupees, as the product form sends it.
 */
export const settleListingSchema = z
  .object({
    listingIds: z.array(z.string().min(1).max(64)).min(1).max(2),
    /** Present when matching to an existing product. */
    productId: z.string().min(1).max(64).optional(),
    /** The title and description chosen; left out when matching keeps the product's own. */
    name: z.string().trim().min(1, "Give the product a name.").max(250).optional(),
    description: z.string().max(5000).optional(),
    /** The listing whose photos the product takes; left out to keep the product's own. */
    photosFrom: z.string().min(1).max(64).optional(),
    /** A photo the owner added on the Settle page, from their library (Q20, Q29). */
    uploadedPhoto: z.string().url().max(2048).optional(),
    sku: z.string().trim().min(1).max(64).optional(),
    price: z.number().positive("Enter a price.").max(10_000_000).optional(),
    categoryId: z.string().min(1, "Pick a category.").max(64).optional(),
    stock: z
      .array(
        z.object({
          locationId: z.string().min(1).max(64),
          quantity: z.number().int().min(0, "Stock can't be below zero.").max(1_000_000),
          seenQuantity: z.number().int().min(0).optional(),
        }),
      )
      .max(50),
    /** "Put it on sale here" when nothing being settled is live (Q12). */
    onSale: z.boolean().optional(),
    /** Answers to the listing's unclear facts, fact → our answer's key; checked against the question on the server (marketplace-facts Q35). */
    answers: z
      .record(z.string().min(1).max(60), z.string().min(1).max(120))
      .refine((a) => Object.keys(a).length <= 60, "Too many answers.")
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.listingIds).size !== value.listingIds.length) {
      ctx.addIssue({ code: "custom", path: ["listingIds"], message: "A listing is named twice." });
    }
    if (value.productId) return;
    if (!value.name) ctx.addIssue({ code: "custom", path: ["name"], message: "Give the product a name." });
    if (!value.sku) ctx.addIssue({ code: "custom", path: ["sku"], message: "Enter a SKU for this product." });
    if (value.price === undefined) ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price." });
    if (!value.categoryId) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Pick a category." });
    if (!value.photosFrom && !value.uploadedPhoto) {
      ctx.addIssue({ code: "custom", path: ["uploadedPhoto"], message: "Add at least one photo." });
    }
  });

export type SettleListingFormValues = z.input<typeof settleListingSchema>;
export type SettleListingParsed = z.output<typeof settleListingSchema>;
