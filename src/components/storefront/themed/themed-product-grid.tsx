import type { Product } from "@/domain/product";
import { cn } from "@/lib/utils";
import type { CardStyle } from "@server/catalog/storefront-themes";
import { Skeleton } from "@/components/ui/skeleton";
import { ASPECT, ThemedProductCard } from "./themed-product-card";
import { GRID } from "./shelf";

export interface ThemedGridStyle {
  shopHandle: string;
  cardStyle: CardStyle;
  /** The theme's phone density: Daily 3-up, the others 2-up (spec Theme cards, "Grid"). */
  columns: 2 | 3;
}

/** The shop page's grid in the theme's card and density; what the landing shelves draw, unbounded. */
export function ThemedProductGrid({ products, shopHandle, cardStyle, columns }: ThemedGridStyle & { products: Product[] }) {
  return (
    <ul className={cn("grid gap-grid", GRID[columns].cols)}>
      {products.map((product) => (
        <li key={product.id}>
          <ThemedProductCard product={product} shopHandle={shopHandle} cardStyle={cardStyle} sizes={GRID[columns].sizes} />
        </li>
      ))}
    </ul>
  );
}

/** The grid while it loads, in the card's own shape (ux.md shop page: Loading, Slow); held back 300 ms so a fast load never flashes. */
export function ThemedGridSkeleton({ cardStyle, columns }: Pick<ThemedGridStyle, "cardStyle" | "columns">) {
  return (
    <ul aria-busy="true" className={cn("grid gap-grid animate-in fade-in fill-mode-backwards delay-300", GRID[columns].cols)}>
      {Array.from({ length: columns * 3 }, (_, i) => (
        <li key={i} className="space-y-2">
          <Skeleton className={cn(ASPECT[cardStyle], "w-full rounded-none")} />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </li>
      ))}
    </ul>
  );
}
