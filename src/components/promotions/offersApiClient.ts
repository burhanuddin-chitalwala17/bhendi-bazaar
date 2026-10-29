import { apiRequest } from "@/lib/api-client";
import type { PlatformPromotionFormInput } from "@/lib/validation/schemas/promotion.schema";

/** Offers, for either portal. The endpoint passed in decides whose offer it is, never the body. */
export const offersApiClient = {
  save: (action: string, method: "POST" | "PATCH", data: PlatformPromotionFormInput) =>
    apiRequest<unknown>(action, { method, body: data }),

  /** A stop, not a delete: an order's discount record may already name the offer (ADR-0020). */
  stop: (stopHref: string) => apiRequest(stopHref, { method: "DELETE" }),
};
