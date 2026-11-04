"use client";

import { useSession } from "next-auth/react";

import { useCartStore } from "@/store/cartStore";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { stockApiClient } from "@/components/product/stockApiClient";
import { useWishlist } from "@/context/WishlistContext";
import { Icon } from "@/components/ui/icon";
import type { CartItem as CartItemType } from "@/domain/cart";
import { CartItem } from "./CartItem";

/** The bag's lines by shop: each shop packs and sends its own parcel. */
export function groupByShop(items: CartItemType[]): Array<{ shop: CartItemType["org"]; items: CartItemType[] }> {
  const groups = new Map<string, { shop: CartItemType["org"]; items: CartItemType[] }>();
  for (const item of items) {
    const group = groups.get(item.org.id) ?? { shop: item.org, items: [] };
    group.items.push(item);
    groups.set(item.org.id, group);
  }
  return [...groups.values()];
}

export function CartLineItems({ items }: { items: CartItemType[] }) {
  const removeItem = useCartStore((state) => state.removeItem);
  const { data: session } = useSession();
  const { isSaved, toggle } = useWishlist();
  // One check for the whole bag, keyed on the product set: a quantity change doesn't move stock.
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

  const moveToSaved = session?.user
    ? async (item: CartItemType) => {
        if (!isSaved(item.productId)) await toggle(item.productId);
        removeItem(item.id);
      }
    : undefined;

  return (
    <div className="space-y-4">
      {groupByShop(items).map(({ shop, items: lines }) => (
        <section key={shop.id} aria-label={`From ${shop.name}`} className="rounded-card border border-border bg-card px-4">
          <p className="flex items-center gap-2 border-b border-border py-3 text-small text-muted-foreground">
            <Icon name="parcel" size="sm" />
            <span>
              From <b className="font-semibold text-foreground">{shop.name}</b> · one parcel
            </span>
          </p>
          <ul className="divide-y divide-border">
            {lines.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                stock={stockByProduct?.[item.productId] ?? null}
                isLoadingStock={isLoadingStock}
                onMoveToSaved={moveToSaved}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
