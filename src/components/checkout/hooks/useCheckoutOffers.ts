"use client";

/**
 * What offers do to this basket, asked of the server.
 *
 * Every eligibility rule stays server-side (Invariant 1): the browser sends product
 * ids, quantities and at most a code, and receives amounts. Nothing here decides what
 * an offer is worth — that would be a second implementation of the engine, and the
 * two would drift.
 */

import { useCallback, useEffect, useState } from "react";
import type { CartItem } from "@/domain/cart";
import { readApiError } from "@/lib/api-error";

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

const EMPTY: OfferQuote = {
  lineDiscounts: {},
  applied: [],
  couponCoveredKeys: [],
  totalDiscountPaise: 0,
  rejection: null,
};

/** The key the server allocates against — product plus chosen variant. */
export const lineKey = (item: Pick<CartItem, "productId" | "size" | "color">) =>
  `${item.productId}::${item.size ?? ""}::${item.color ?? ""}`;

export function useCheckoutOffers(items: CartItem[]) {
  const [quote, setQuote] = useState<OfferQuote>(EMPTY);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [isPricing, setIsPricing] = useState(false);

  const payload = items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    size: item.size || undefined,
    color: item.color || undefined,
  }));
  // Re-quote when the basket changes, not on every render.
  const basketKey = JSON.stringify(payload);

  const price = useCallback(
    async (code: string | null): Promise<OfferQuote> => {
      if (payload.length === 0) return EMPTY;
      setIsPricing(true);
      try {
        const response = await fetch("/api/checkout/promotions/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload, code: code || undefined }),
        });
        if (!response.ok) throw await readApiError(response);
        return (await response.json()) as OfferQuote;
      } finally {
        setIsPricing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [basketKey]
  );

  // Automatic offers, with no code — what the buyer already had before typing one.
  useEffect(() => {
    let cancelled = false;
    price(appliedCode)
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch(() => {
        // A pricing failure must not block checkout: the server recomputes every
        // figure inside the order transaction anyway, and the displayed-total guard
        // refuses anything that disagrees.
        if (!cancelled) setQuote(EMPTY);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketKey, appliedCode]);

  /** Try a code. Returns the quote so the caller can report a refusal. */
  const applyCode = useCallback(
    async (code: string): Promise<OfferQuote> => {
      const result = await price(code);
      setQuote(result);
      // A refused code is not "applied" — keeping it would re-send it on every
      // re-quote and re-show the same refusal.
      setAppliedCode(result.rejection === null ? code : null);
      return result;
    },
    [price]
  );

  const clearCode = useCallback(() => {
    setAppliedCode(null);
    setQuote((current) => ({ ...current, rejection: null }));
  }, []);

  return { quote, appliedCode, isPricing, applyCode, clearCode };
}
