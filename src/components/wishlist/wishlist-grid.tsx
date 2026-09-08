"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import type { WishlistProduct } from "@server/wishlist/wishlist.types";
import { Card } from "@/components/ui/card";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { StockStatus } from "@/components/shared/StockStatus";
import { PRODUCT_GRID_CLASSES } from "@/components/shared/product-grid";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { useWishlist } from "@/context/WishlistContext";

/**
 * The saved-products listing.
 *
 * A client component so un-hearting removes the tile immediately: the server read that
 * produced `items` is a snapshot, and the shared saved-set is what says which of them
 * are still wanted. Filtering here rather than refetching also means the removal
 * survives a failed write reverting — the tile comes back with the state.
 */
export function WishlistGrid({ items }: { items: WishlistProduct[] }) {
  const { isSaved } = useWishlist();
  const visible = items.filter((item) => isSaved(item.productId));

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Nothing saved yet"
        description="Tap the heart on any product to keep it here for later."
      />
    );
  }

  return (
    <div className={PRODUCT_GRID_CLASSES}>
      {visible.map((item) => (
        <Link
          key={item.id}
          href={`/product/${item.slug}`}
          className="block"
          prefetch={false}
        >
          <Card className="group h-full gap-0 overflow-hidden rounded-lg py-0 transition-all sm:rounded-xl md:hover:-translate-y-1 md:hover:shadow-lifted">
            <div className="relative aspect-[3/4] overflow-hidden bg-muted">
              <img
                src={item.thumbnail}
                alt={item.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform md:group-hover:scale-105"
              />
              <div className="absolute right-1 top-1 z-10 sm:right-2 sm:top-2">
                <WishlistButton
                  productId={item.productId}
                  className="bg-card/80 shadow-raised backdrop-blur-sm"
                />
              </div>
              {item.stock === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-scrim/60">
                  <span className="text-3xs font-semibold uppercase tracking-wide text-primary-foreground sm:text-sm sm:tracking-normal">
                    Out of Stock
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1 p-2 sm:space-y-2 sm:p-4">
              <h3 className="line-clamp-2 font-heading text-2xs font-semibold leading-snug tracking-tight sm:text-sm">
                {item.name}
              </h3>
              <PriceDisplay
                price={item.price}
                salePrice={item.salePrice}
                size="xs"
                showBadge={false}
              />
              <StockStatus
                stock={item.stock}
                lowStockThreshold={item.lowStockThreshold}
                size="xs"
                variant="warn-only"
              />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
