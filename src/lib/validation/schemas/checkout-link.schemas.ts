import { z } from "zod";

/** Opening a checkout link: the address's two parts, nothing else (checkout-links D2, D3). */
export const openCheckoutLinkSchema = z.object({
  shop: z.string().min(1).max(100),
  token: z.string().min(1).max(64),
});

export type OpenCheckoutLinkInput = z.infer<typeof openCheckoutLinkSchema>;
