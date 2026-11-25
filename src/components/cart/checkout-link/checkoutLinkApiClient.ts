import { apiRequest } from "@/lib/api-client";
import type { CheckoutLinkNote, CheckoutLinkNotesRequest, OpenCheckoutLinkResult } from "@server/cart/checkout-link.types";

/** Checkout links, from the buyer's side. */
export const checkoutLinkApiClient = {
  /** The lines this link adds to this cart, with the sizes picked on its size step; empty when this cart has opened it before. */
  open(shop: string, token: string, sizes: readonly string[] = []): Promise<OpenCheckoutLinkResult> {
    return apiRequest("/api/checkout-links/open", { method: "POST", body: { shop, token, sizes } });
  },

  /** What checkout says about the links its lines came from: left out, price moved (D4). */
  notes(links: CheckoutLinkNotesRequest[], signal?: AbortSignal): Promise<CheckoutLinkNote[]> {
    return apiRequest("/api/checkout-links/notes", { method: "POST", body: { links }, signal });
  },
};
