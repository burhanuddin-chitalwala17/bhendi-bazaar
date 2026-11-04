import { ProductGrid } from "@/components/shared/product-grid";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/states/EmptyState";
import type { NewestSlice } from "./sections";
import { BRAND_PAGE_COPY } from "./brand-page-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * The newest goods, as the marketplace's own tiles (brand-page R6, D5): same price, same
 * offer, same stock, same suspension when up for bidding, because the tile is the same
 * component and the rows came through the same read as the landing page's grid.
 *
 * With nothing listed, the honest state the storefront itself shows (storefront-pages
 * R7a) — the first state every shop is in, and not a placeholder about the org (A1).
 */
export function NewestGoods({ handle, name, products }: NewestSlice) {
  return (
    <section className="space-y-3">
      <SectionHeader
        overline={BRAND_PAGE_COPY.overline}
        title={BRAND_PAGE_COPY.newest(name)}
        action={
          products.length
            ? { label: BRAND_PAGE_COPY.seeAll, href: ROUTES.store(handle) }
            : undefined
        }
      />
      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState
          title={BRAND_PAGE_COPY.emptyTitle}
          description={BRAND_PAGE_COPY.emptyDescription(name)}
        />
      )}
    </section>
  );
}
