"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/store/cartStore";
import { CartItem } from "./CartItem";

export function CartLineItems() {
  const items = useCartStore((state) => state.items);
  const [stockByProduct, setStockByProduct] = useState<Record<string, number>>({});
  const [isLoadingStock, setIsLoadingStock] = useState(true);

  // One check for the whole cart — the endpoint takes the full array, so per-row
  // fetches were N round trips for one answer. Keyed on the product-id set: a
  // quantity change doesn't move stock, so it doesn't re-ask.
  const productIdsKey = items
    .map((item) => item.productId)
    .sort()
    .join(",");

  useEffect(() => {
    if (!productIdsKey) return;
    const controller = new AbortController();
    setIsLoadingStock(true);
    fetch("/api/products/check-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: productIdsKey
          .split(",")
          .map((productId) => ({ productId, quantity: 1 })),
      }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { items?: Array<{ productId: string; stock: number }> }) => {
        const next: Record<string, number> = {};
        for (const row of data.items ?? []) next[row.productId] = row.stock;
        setStockByProduct(next);
        setIsLoadingStock(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch stock:", err);
        setIsLoadingStock(false);
      });
    return () => controller.abort();
  }, [productIdsKey]);

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
          stock={stockByProduct[item.productId] ?? null}
          isLoadingStock={isLoadingStock}
        />
      ))}
    </div>
  );
}
