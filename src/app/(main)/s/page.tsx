import type { Metadata } from "next";

import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { PageHeader } from "@/components/shared/page-shell";
import { ListingToolbar, parseSort, type ListingFilter } from "@/components/shared/listing-toolbar";
import { productsDAL } from "@/data-access-layer/products.dal";

// Every query is a new address; indexing them would flood the index with thin duplicates.
// Followed, so the products listed still gain from the link (seo R8).
export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

const FILTERS: ListingFilter[] = [{ label: "On offer", param: "offers", value: "1" }];

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
        <PageHeader title="Search" description="Use the search bar above to find ridas, abayas, shops and more." />
        <EmptyState title="What are you looking for?" description="Type a word or two: a fabric, a colour, a shop." action={{ label: "Browse the shop", href: "/shop" }} />
      </div>
    );
  }

  const sort = parseSort(params.sort);
  const offersOnly = params.offers === "1";
  const filter = { search: q, offerOnly: offersOnly };
  const [page, count] = await Promise.all([productsDAL.getPage(filter, { sort }), productsDAL.countListing(filter)]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Search" title={`“${q}”`} />
      <ListingToolbar
        basePath="/s"
        params={{ q, sort: sort === "newest" ? undefined : sort, offers: offersOnly ? "1" : undefined }}
        count={count}
        filters={FILTERS}
      />
      {page.products.length > 0 ? (
        <PaginatedProductGrid initial={page.products} initiallyDone={page.done} query={{ search: q, offersOnly, sort }} emptyLabel="results" />
      ) : (
        <EmptyState
          title={`Nothing matches “${q}”`}
          description="Try a shorter word, another spelling, or browse by category."
          action={{ label: "Browse the shop", href: "/shop" }}
        />
      )}
    </div>
  );
}
