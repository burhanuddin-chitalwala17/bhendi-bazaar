import { apiRequest } from "@/lib/api-client";

export interface CouponRejection {
  code: string;
  reason: string;
  message: string;
  shortfallPaise?: number;
}

export interface OfferQuote {
  lineDiscounts: Record<string, number>;
  applied: Array<{ label: string; code: string | null; amountPaise: number }>;
  couponCoveredKeys: string[];
  totalDiscountPaise: number;
  rejection: CouponRejection | null;
}

export interface OfferQuoteLine {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
}

/** Sends ids, quantities and at most a code; every amount comes back from the server (Invariant 1). */
export const checkoutOffersApiClient = {
  quote(items: OfferQuoteLine[], code?: string): Promise<OfferQuote> {
    return apiRequest("/api/checkout/promotions/quote", { method: "POST", body: { items, code } });
  },
};
