import type { Product } from "@/domain/product";
import { ProductCard } from "@/components/shared/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PRODUCT_GRID_COPY } from "./shared-copy";

/**
 * The one product grid, so a lane, a category and a search result can't drift apart: 2-up on a
 * phone, 3-up on a tablet, 4-up on a desktop (design-system Q12, Q19). PRODUCT_TILE_SIZES moves with it.
 */
export const PRODUCT_GRID_CLASSES = "grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-4 lg:grid-cols-6 lg:gap-x-5 lg:gap-y-8";

/** A long grid skips painting tiles off screen (ADR-0066 D7); the reserved height stops the scrollbar jumping. */
const OFFSCREEN = "[content-visibility:auto] [contain-intrinsic-size:auto_22rem]";

export function ProductGrid({ products, className }: { products: Product[]; className?: string }) {
  return (
    <ul className={cn(PRODUCT_GRID_CLASSES, className)}>
      {products.map((product) => (
        <li key={product.id} className={OFFSCREEN}>
          <ProductCard {...product} />
        </li>
      ))}
    </ul>
  );
}

/** The grid while it loads, in the tile's own shape, so nothing moves when it lands. */
export function SkeletonProductGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <ul aria-busy="true" aria-label={PRODUCT_GRID_COPY.loadingProducts} className={cn(PRODUCT_GRID_CLASSES, className)}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="space-y-2">
          <Skeleton className="aspect-4/5 w-full rounded-field" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-1/3" />
        </li>
      ))}
    </ul>
  );
}
