import { z } from "zod";
import { CHANNELS } from "@server/shared/channels";
import { PRODUCT_SHELVES } from "@server/catalog/product.visibility";

/**
 * Which of a shop's products a list shows, as one shape (design-system Q35): the products page
 * reads it from the URL, and "Select all" sends it back so the server finds the products itself.
 * The org is never in it: it comes from the path.
 */
export const productListScopeSchema = z.strictObject({
  search: z.string().trim().max(200).optional(),
  categoryId: z.string().trim().min(1).max(64).optional(),
  shelf: z.enum(PRODUCT_SHELVES).optional(),
  lowStock: z.boolean().optional(),
  outOfStock: z.boolean().optional(),
  wishlistedOnly: z.boolean().optional(),
  /** Only the products this channel would refuse as they stand. */
  notReadyOn: z.enum(CHANNELS).optional(),
});

export type ProductListScope = z.infer<typeof productListScopeSchema>;

/** A typed URL's channel: one the platform has, or none. An unknown value is ignored, never trusted. */
export const parseNotReadyOn = (raw: string | undefined) => {
  const parsed = productListScopeSchema.shape.notReadyOn.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
};
