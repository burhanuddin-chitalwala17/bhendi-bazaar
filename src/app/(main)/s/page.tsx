import type { Metadata } from "next";

import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { PageHeader } from "@/components/shared/page-shell";
import { ListingToolbar, parseSort, type ListingFilter } from "@/components/shared/listing-toolbar";
import { productsDAL } from "@/data-access-layer/products.dal";
import { SEARCH_PAGE_COPY } from "./search-page-copy";
import { ROUTES } from "@server/shared/routes";

// Every query is a new address; indexing them would flood the index with thin duplicates.
// Followed, so the products listed still gain from the link (seo R8).
export const metadata: Metadata = { title: SEARCH_PAGE_COPY.title, robots: { index: false, follow: true } };

const FILTERS: ListingFilter[] = [{ label: SEARCH_PAGE_COPY.onOfferFilter, param: "offers", value: "1" }];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; offers?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  // No words is not a search: say what this page is for rather than titling it "undefined".
  if (!q) {
    return (
      <div className="space-y-6">
        <PageHeader title={SEARCH_PAGE_COPY.title} description={SEARCH_PAGE_COPY.emptyDescription} />
        <EmptyState title={SEARCH_PAGE_COPY.promptTitle} description={SEARCH_PAGE_COPY.promptBody} action={{ label: SEARCH_PAGE_COPY.browseShop, href: ROUTES.shopAll }} />
      </div>
    );
  }

  const sort = parseSort(params.sort);
  const offersOnly = params.offers === "1";
  const filter = { search: q, offerOnly: offersOnly };
  const [page, count] = await Promise.all([productsDAL.getPage(filter, { sort }), productsDAL.countListing(filter)]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={SEARCH_PAGE_COPY.eyebrow} title={SEARCH_PAGE_COPY.query(q)} />
      <ListingToolbar
        basePath={ROUTES.search}
        params={{ q, sort: sort === "newest" ? undefined : sort, offers: offersOnly ? "1" : undefined }}
        count={count}
        filters={FILTERS}
      />
      {page.products.length > 0 ? (
        <PaginatedProductGrid initial={page.products} initiallyDone={page.done} query={{ search: q, offersOnly, sort }} emptyLabel={SEARCH_PAGE_COPY.emptyLabel} />
      ) : (
        <EmptyState
          title={SEARCH_PAGE_COPY.noMatchTitle(q)}
          description={SEARCH_PAGE_COPY.noMatchBody}
          action={{ label: SEARCH_PAGE_COPY.browseShop, href: ROUTES.shopAll }}
        />
      )}
    </div>
  );
}
