"use client";

import { useCartStore } from "@/store/cartStore";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { stockApiClient } from "@/components/product/stockApiClient";
import { CartItem } from "./CartItem";

export function CartLineItems() {
  const items = useCartStore((state) => state.items);
  // One check for the whole cart — the endpoint takes the full array, so per-row
  // fetches were N round trips for one answer. Keyed on the product-id set: a
  // quantity change doesn't move stock, so it doesn't re-ask.
  const productIdsKey = items
    .map((item) => item.productId)
    .sort()
    .join(",");

  const { data: stockByProduct, loading, error } = useAsyncData(
    async (signal) => {
      const { items: rows } = await stockApiClient.check(
        productIdsKey.split(",").map((productId) => ({ productId, quantity: 1 })),
        signal,
      );
      const next: Record<string, number> = {};
      for (const row of rows) next[row.productId] = row.stock;
      return next;
    },
    {
      enabled: Boolean(productIdsKey),
      refetchDependencies: [productIdsKey],
      onError: (err) => console.error("Failed to fetch stock:", err),
    },
  );
  // Loading until the first answer or failure, not only while a request is in flight.
  const isLoadingStock = loading || (stockByProduct === null && error === null);

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Your cart is quiet right now. Start with an emerald abaya or a scented
        attar from the Home page.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <CartItem
          key={item.id}
          item={item}
          stock={stockByProduct?.[item.productId] ?? null}
          isLoadingStock={isLoadingStock}
        />
      ))}
    </div>
  );
}
