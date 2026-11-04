import { SectionHeader } from "@/components/shared/SectionHeader";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { Product } from "@/domain/product";

/** Two rows of the desktop's 4-up grid, four of the phone's; the rest load as the shopper scrolls. */
export const HEROES_FIRST_PAGE = 8;

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
      <SectionHeader title="Chosen from the lanes" description="Pieces the shops are proudest of" />
      <PaginatedProductGrid
        initial={heroes}
        initiallyDone={done}
        query={{ heroOnly: true }}
        emptyLabel="hero pieces"
      />
    </section>
  );
}
