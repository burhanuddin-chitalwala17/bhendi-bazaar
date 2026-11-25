import { checkoutLinkService } from "@server/cart/checkout-link.service";
import type { CheckoutLinkResolution } from "@server/cart/checkout-link.types";

/** What a `/c/<shop>/<token>` address is before anything is added (checkout-links D2, D3). */
export const checkoutLinksDAL = {
  resolve: (shop: string, token: string): Promise<CheckoutLinkResolution> => checkoutLinkService.resolve(shop, token),
};
