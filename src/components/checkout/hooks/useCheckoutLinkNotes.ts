"use client";

import { useMemo } from "react";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { checkoutLinkApiClient } from "@/components/cart/checkout-link/checkoutLinkApiClient";
import type { CartItem } from "@/domain/cart";
import type { CheckoutLinkNote, CheckoutLinkNotesRequest } from "@server/cart/checkout-link.types";

const NO_NOTES: CheckoutLinkNote[] = [];

/** What the server says about the links this checkout's lines came from (checkout-links D4). */
export function useCheckoutLinkNotes(items: CartItem[]) {
  const requests = useMemo<CheckoutLinkNotesRequest[]>(() => {
    const byLink = new Map<string, string[]>();
    for (const item of items) {
      if (item.fromLinkId) byLink.set(item.fromLinkId, [...(byLink.get(item.fromLinkId) ?? []), item.productId]);
    }
    return [...byLink].slice(0, 10).map(([linkId, productIds]) => ({ linkId, productIds }));
  }, [items]);
  const key = JSON.stringify(requests);

  const { data } = useAsyncData((signal) => checkoutLinkApiClient.notes(requests, signal), {
    enabled: requests.length > 0,
    refetchDependencies: [key],
  });
  return requests.length > 0 ? (data ?? NO_NOTES) : NO_NOTES;
}
