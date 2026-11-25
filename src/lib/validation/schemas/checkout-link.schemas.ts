import { z } from "zod";

/** Opening a checkout link: the address's two parts and the sizes picked on its size step (checkout-links D2, D3, D6). */
export const openCheckoutLinkSchema = z.object({
  shop: z.string().min(1).max(100),
  token: z.string().min(1).max(64),
  sizes: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export type OpenCheckoutLinkInput = z.infer<typeof openCheckoutLinkSchema>;

/** Checkout's question about the links its lines came from: ids and product ids only (checkout-links D4). */
export const checkoutLinkNotesSchema = z.object({
  links: z
    .array(
      z.object({
        linkId: z.string().min(1).max(40),
        productIds: z.array(z.string().min(1).max(40)).max(20),
      }),
    )
    .min(1)
    .max(10),
});

export type CheckoutLinkNotesInput = z.infer<typeof checkoutLinkNotesSchema>;
