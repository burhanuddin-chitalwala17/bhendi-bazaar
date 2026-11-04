import type { Metadata } from "next";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { PageHeader } from "@/components/shared/page-shell";
import { ListingToolbar, parseSort } from "@/components/shared/listing-toolbar";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { productsDAL } from "@/data-access-layer/products.dal";
import { appUrl } from "@server/shared/app-url";
import { OFFERS_PAGE_COPY } from "./offers-page-copy";
import { ROUTES } from "@server/shared/routes";

export const metadata: Metadata = {
  title: OFFERS_PAGE_COPY.metaTitle,
  description: OFFERS_PAGE_COPY.metaDescription,
  alternates: { canonical: `${appUrl()}${ROUTES.offers}` },
};

/** Everything on offer, where the strip's "View more" lands; the same coverage query the strip runs (ADR-0018). */
export default async function OffersPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sort = parseSort((await searchParams).sort);
  const filter = { offerOnly: true };
  const [page, count] = await Promise.all([productsDAL.getPage(filter, { sort }), productsDAL.countListing(filter)]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={OFFERS_PAGE_COPY.eyebrow} title={OFFERS_PAGE_COPY.title} />
      <ListingToolbar basePath={ROUTES.offers} params={{ sort: sort === "newest" ? undefined : sort }} count={count} />
      {page.products.length > 0 ? (
        <PaginatedProductGrid initial={page.products} initiallyDone={page.done} query={{ offersOnly: true, sort }} emptyLabel={OFFERS_PAGE_COPY.emptyLabel} />
      ) : (
        <EmptyState
          title={OFFERS_PAGE_COPY.emptyTitle}
          description={OFFERS_PAGE_COPY.emptyBody}
          action={{ label: OFFERS_PAGE_COPY.browseShop, href: ROUTES.shopAll }}
        />
      )}
    </div>
  );
}
