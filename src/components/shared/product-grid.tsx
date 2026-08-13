import type { Product } from "@/domain/product";
import { ProductCard } from "@/components/shared/product-card";
import { cn } from "@/lib/utils";

/** The one product grid. 3-up on a phone (ADR-0016) — a shopper scanning a category
 *  compares tiles against each other, and one-per-screen makes that impossible —
 *  widening to the roomier desktop layout from `md`. Declared once so a lane, a
 *  category listing, and a search result can't drift apart. */
export const PRODUCT_GRID_CLASSES =
  "grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-2 md:gap-5 lg:grid-cols-3";

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
