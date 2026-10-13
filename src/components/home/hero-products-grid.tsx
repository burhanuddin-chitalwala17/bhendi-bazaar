import { SectionHeader } from "@/components/shared/SectionHeader";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { Product } from "@/domain/product";

/** Three rows of the phone's 3-up grid (ADR-0016); the rest load as the shopper scrolls. */
export const HEROES_FIRST_PAGE = 9;

export function HeroProductsGrid({
  heroes,
  done,
}: {
  heroes: Product[];
  done: boolean;
}) {
  if (heroes.length === 0) return null;

  return (
    <section className="space-y-3 sm:space-y-4">
      <SectionHeader overline="Hero Pieces" title="Curated from the lanes" />
      <PaginatedProductGrid
        initial={heroes}
        initiallyDone={done}
        query={{ heroOnly: true }}
        emptyLabel="hero pieces"
      />
    </section>
  );
}
