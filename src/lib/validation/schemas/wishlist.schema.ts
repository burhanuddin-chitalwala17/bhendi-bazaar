import { z } from "zod";

/**
 * A wishlist write says one thing: which product. Everything else about the row —
 * whose wishlist, when it was saved — is server-owned and never accepted as input
 * (Invariant 4).
 */
export const wishlistItemSchema = z.object({
  productId: z.string().min(1, "Pick a product to save"),
});

export type WishlistItemInput = z.infer<typeof wishlistItemSchema>;
