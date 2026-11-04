import Image from "next/image";
import Link from "next/link";

import { percentOff, type Product } from "@/domain/product";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { PriceDisplay } from "./PriceDisplay";
import { PRODUCT_CARD_COPY } from "./shared-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * The slot a tile occupies, per PRODUCT_GRID_CLASSES: half a phone, a third of a tablet, a quarter
 * of the 90rem page from `lg`. Moves with the grid (design-system Q19), or a tile downloads more
 * than it shows (ADR-0026). `tests/unit/product-grid-sizes.test.ts` holds the two together.
 */
export const PRODUCT_TILE_SIZES = "(min-width: 1024px) 360px, (min-width: 768px) 33vw, 50vw";

/** One product in a grid: the photograph first, then who sells it, what it is and what it costs. */
export function ProductCard(product: Product) {
  const off = percentOff(product);
  const soldOut = product.stock === 0;

  return (
    <div className="group relative flex flex-col gap-2.5">
      <div className="relative aspect-4/5 overflow-hidden rounded-field bg-muted">
        {/* Prefetch off: a grid puts a dozen in view and a dynamic route's prefetch is discarded unused. */}
        <Link href={ROUTES.product(product.slug)} prefetch={false} className="absolute inset-0">
          <Image
            src={product.thumbnail}
            alt={product.name}
            fill
            sizes={PRODUCT_TILE_SIZES}
            className="object-cover transition-transform duration-slow ease-standard md:group-hover:scale-105"
          />
          {soldOut && (
            <span className="absolute inset-x-0 bottom-0 bg-photo-scrim py-1.5 text-center text-caption font-semibold text-on-photo">
              {PRODUCT_CARD_COPY.soldOut}
            </span>
          )}
        </Link>
        {off > 0 && !soldOut && (
          <StatusBadge tone="deal" className="pointer-events-none absolute left-1.5 top-1.5">
            {off}% off
          </StatusBadge>
        )}
        {/* Outside the link so saving never opens the product; a sold-out piece is still worth saving. */}
        <div className="absolute right-1.5 top-1.5">
          <WishlistButton productId={product.id} className="bg-background/90 shadow-raised backdrop-blur-sm" />
        </div>
      </div>

      <Link href={ROUTES.product(product.slug)} prefetch={false} className="flex flex-col gap-0.5">
        {product.org?.name && <span className="truncate text-caption text-muted-foreground">{product.org.name}</span>}
        <h3 className="line-clamp-2 text-small font-medium text-foreground">{product.name}</h3>
        <PriceDisplay price={product.price} salePrice={product.salePrice} size="sm" showBadge={false} className="mt-0.5" />
      </Link>
    </div>
  );
}
