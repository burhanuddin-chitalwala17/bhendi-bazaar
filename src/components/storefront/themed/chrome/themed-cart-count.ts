"use client";

import { useCartStore } from "@/store/cartStore";

/** The marketplace's one cart, counted (own-store Q22): a themed shop never has its own. */
export function useCartCount(): number {
  return useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
}
