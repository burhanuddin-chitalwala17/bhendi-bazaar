import { apiRequest } from "@/lib/api-client";
import type { OpenCheckoutLinkResult } from "@server/cart/checkout-link.types";

/** Checkout links, from the buyer's side. */
export const checkoutLinkApiClient = {
  /** The lines this link adds to this cart; empty when this cart has opened it before. */
  open(shop: string, token: string): Promise<OpenCheckoutLinkResult> {
    return apiRequest("/api/checkout-links/open", { method: "POST", body: { shop, token } });
  },
};
