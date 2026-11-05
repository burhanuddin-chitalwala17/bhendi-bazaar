import { SectionHeader } from "@/components/shared/SectionHeader";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { Product } from "@/domain/product";
import { STORE_HOME_COPY } from "./store-home-copy";

/** Two rows of the desktop's 6-up grid, six of the phone's; the rest load as the shopper scrolls. */
export const HEROES_FIRST_PAGE = 12;

export function HeroProductsGrid({
  heroes,
  done,
}: {
  heroes: Product[];
  done: boolean;
}) {
  if (heroes.length === 0) return null;

  return (
    <section className="space-y-4">
      <SectionHeader title={STORE_HOME_COPY.heroes.title} description={STORE_HOME_COPY.heroes.description} />
      <PaginatedProductGrid
        initial={heroes}
        initiallyDone={done}
        query={{ heroOnly: true }}
        emptyLabel={STORE_HOME_COPY.heroes.shownLabel}
      />
    </section>
  );
}
