import type { Product } from "@/domain/product";
import { ProductCard } from "@/components/shared/product-card";
import { cn } from "@/lib/utils";

/** The one product grid, so a lane, a category and a search result can't drift apart: 2-up on a
 *  phone and tablet, 3-up from `lg` (2-up on phones since b2c4ce46). PRODUCT_TILE_SIZES moves with it. */
export const PRODUCT_GRID_CLASSES =
  "grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3";

export function ProductGrid({
  products,
  className,
}: {
  products: Product[];
  className?: string;
}) {
  return (
    <div className={cn(PRODUCT_GRID_CLASSES, className)}>
      {products.map((product) => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  );
}
