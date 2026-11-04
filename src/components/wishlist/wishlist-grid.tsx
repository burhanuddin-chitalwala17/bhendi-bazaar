"use client";

import Image from "next/image";
import Link from "next/link";
import type { WishlistProduct } from "@server/wishlist/wishlist.types";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { StockStatus } from "@/components/shared/StockStatus";
import { PRODUCT_GRID_CLASSES } from "@/components/shared/product-grid";
import { PRODUCT_TILE_SIZES } from "@/components/shared/product-card";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { useWishlist } from "@/context/WishlistContext";

/** Saved products; a client component so un-hearting removes the tile at once, and a failed write brings it back. */
export function WishlistGrid({ items }: { items: WishlistProduct[] }) {
  const { isSaved } = useWishlist();
  const visible = items.filter((item) => isSaved(item.productId));

  if (visible.length === 0) {
    return (
      <EmptyState
        title="Nothing saved yet"
        description="Tap the heart on any piece to keep it here for later."
        action={{ label: "Start browsing", href: "/shop" }}
      />
    );
  }

  return (
    <ul className={PRODUCT_GRID_CLASSES}>
      {visible.map((item) => (
        <li key={item.id} className="group relative flex flex-col gap-2.5">
          <div className="relative aspect-4/5 overflow-hidden rounded-field bg-muted">
            <Link href={`/product/${item.slug}`} prefetch={false} className="absolute inset-0">
              <Image
                src={item.thumbnail}
                alt={item.name}
                fill
                sizes={PRODUCT_TILE_SIZES}
                className="object-cover transition-transform duration-slow ease-standard md:group-hover:scale-105"
              />
              {item.stock === 0 && (
                <span className="absolute inset-x-0 bottom-0 bg-photo-scrim py-1.5 text-center text-caption font-semibold text-on-photo">
                  Sold out
                </span>
              )}
            </Link>
            <div className="absolute right-1.5 top-1.5">
              <WishlistButton productId={item.productId} className="bg-background/90 shadow-raised backdrop-blur-sm" />
            </div>
          </div>
          <Link href={`/product/${item.slug}`} prefetch={false} className="flex flex-col gap-0.5">
            <h3 className="line-clamp-2 text-small font-medium text-foreground">{item.name}</h3>
            <PriceDisplay price={item.price} salePrice={item.salePrice} size="sm" showBadge={false} />
            <StockStatus stock={item.stock} lowStockThreshold={item.lowStockThreshold} size="xs" variant="warn-only" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
