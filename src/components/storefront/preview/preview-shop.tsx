import type { Product } from "@/domain/product";
import { formatCount } from "@/lib/format";
import { COMPOSITIONS, THEMES, type ThemeKey } from "@server/catalog/storefront-themes";
import { visitLabel } from "../themed/section-heading";
import { ThemedProductGrid } from "../themed/themed-product-grid";

/**
 * The shop page as the preview's "Shop" switch draws it (ux.md journey 1): the heading and the
 * grid in the theme's card and density, without the filters a buyer's page fetches as they tap.
 */
export function PreviewShop({
  theme,
  handle,
  name,
  total,
  products,
}: {
  theme: ThemeKey;
  handle: string;
  name: string;
  total: number;
  products: Product[];
}) {
  return (
    <section className="mx-auto max-w-store space-y-4 px-gutter py-section">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-label text-tag uppercase tracking-tag text-muted-foreground">
            {formatCount(total)} {total === 1 ? "product" : "products"}
          </p>
          <h1 className="break-words font-display text-title tracking-headline">{name}</h1>
        </div>
        <span className="shrink-0 font-label text-tag uppercase tracking-tag underline underline-offset-4">
          {visitLabel(name)}
        </span>
      </div>
      <ThemedProductGrid
        products={products}
        shopHandle={handle}
        cardStyle={COMPOSITIONS[theme].cardStyle}
        columns={THEMES[theme].phoneColumns}
      />
    </section>
  );
}
