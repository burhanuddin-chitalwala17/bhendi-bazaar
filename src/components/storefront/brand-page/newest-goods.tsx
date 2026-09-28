import { Package } from "lucide-react";

import { ProductGrid } from "@/components/shared/product-grid";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/states/EmptyState";
import type { NewestSlice } from "./sections";

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
        overline="The shop"
        title={`Newest from ${name}`}
        action={
          products.length
            ? { label: "See all", href: `/store/${handle}` }
            : undefined
        }
      />
      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState
          icon={Package}
          title="Nothing here just yet"
          description={`${name} has not listed anything for sale. Come back soon.`}
        />
      )}
    </section>
  );
}
