"use client";

import { useCallback, useState } from "react";
import { useCartStore } from "@/store/cartStore";
import type { CartItem } from "@/domain/cart";

/**
 * The lines this checkout is for, taken once: the sign-in cart merge updates the store, never
 * this checkout's items (seamless-sign-in D11, R15). Taken only after the saved cart has been
 * read. A child's effect runs before the provider's rehydrate, so an earlier snapshot can be
 * empty and stay empty (docs/GTM-READINESS.md B9).
 */
const NONE: CartItem[] = [];

export function useCheckoutSnapshot(buyNowProduct?: CartItem) {
  const cartHydrated = useCartStore((state) => state.hasHydrated);
  const [items, setItems] = useState<CartItem[] | null>(() => (buyNowProduct ? [buyNowProduct] : null));
  // Adjusted during render, not in an effect: the first render after hydration already has them.
  if (items === null && cartHydrated) setItems(useCartStore.getState().items);

  /** Take a line out of this checkout and the bag together (checkout-links R3: "each removable"). */
  const remove = useCallback((line: CartItem) => {
    setItems((current) => current?.filter((item) => item.id !== line.id) ?? current);
    useCartStore.getState().removeLines([line]);
  }, []);

  return { items: items ?? NONE, ready: items !== null, remove };
}
