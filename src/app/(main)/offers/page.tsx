import type { Metadata } from "next";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { PageHeader } from "@/components/shared/page-shell";
import { ListingToolbar, parseSort } from "@/components/shared/listing-toolbar";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { productsDAL } from "@/data-access-layer/products.dal";
import { appUrl } from "@server/shared/app-url";

export const metadata: Metadata = {
  title: "Offers",
  description: "Everything reduced right now on Bhendi Bazaar.",
  alternates: { canonical: `${appUrl()}/offers` },
};

/** Everything on offer, where the strip's "View more" lands; the same coverage query the strip runs (ADR-0018). */
export default async function OffersPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sort = parseSort((await searchParams).sort);
  const filter = { offerOnly: true };
  const [page, count] = await Promise.all([productsDAL.getPage(filter, { sort }), productsDAL.countListing(filter)]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Offers" title="Everything reduced right now" />
      <ListingToolbar basePath="/offers" params={{ sort: sort === "newest" ? undefined : sort }} count={count} />
      {page.products.length > 0 ? (
        <PaginatedProductGrid initial={page.products} initiallyDone={page.done} query={{ offersOnly: true, sort }} emptyLabel="offers" />
      ) : (
        <EmptyState
          title="No offers running"
          description="Nothing is reduced at the moment. Check back soon."
          action={{ label: "Browse the shop", href: "/shop" }}
        />
      )}
    </div>
  );
}
