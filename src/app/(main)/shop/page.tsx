import type { Metadata } from "next";
import Link from "next/link";

import { CategoryLanes } from "@/components/category/category-lanes";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { PageHeader } from "@/components/shared/page-shell";
import { ListingToolbar, parseSort, type ListingFilter } from "@/components/shared/listing-toolbar";
import { Icon } from "@/components/ui/icon";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { productsDAL } from "@/data-access-layer/products.dal";
import { appUrl } from "@server/shared/app-url";

export const metadata: Metadata = {
  title: "Shop",
  description: "Every piece on sale in Bhendi Bazaar, from every shop.",
  alternates: { canonical: `${appUrl()}/shop` },
};

const FILTERS: ListingFilter[] = [{ label: "On offer", param: "offers", value: "1" }];

/** The Shop tab (design-system Q21): every category, a way to the shops, and the whole catalogue. */
export default async function ShopPage({ searchParams }: { searchParams: Promise<{ sort?: string; offers?: string }> }) {
  const params = await searchParams;
  const sort = parseSort(params.sort);
  const offersOnly = params.offers === "1";
  const filter = { offerOnly: offersOnly };

  const [categories, page, count] = await Promise.all([
    categoriesDAL.getDescendants(null),
    productsDAL.getPage(filter, { sort }),
    productsDAL.countListing(filter),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Shop" description="Everything in the bazaar, newest first." />
      <CategoryLanes categories={categories} />
      <Link
        href="/store"
        prefetch={false}
        className="flex min-h-12 items-center gap-3 rounded-card border border-border bg-card px-4 py-3 transition-colors duration-fast hover:bg-muted"
      >
        <Icon name="shop" size="lg" tone="primary" />
        <span className="flex-1">
          <span className="block text-small font-semibold text-foreground">Browse by shop</span>
          <span className="block text-caption text-muted-foreground">Every shop trading on Bhendi Bazaar</span>
        </span>
        <Icon name="next" size="sm" tone="muted" />
      </Link>
      <ListingToolbar
        basePath="/shop"
        params={{ sort: sort === "newest" ? undefined : sort, offers: offersOnly ? "1" : undefined }}
        count={count}
        filters={FILTERS}
      />
      {page.products.length > 0 ? (
        <PaginatedProductGrid initial={page.products} initiallyDone={page.done} query={{ offersOnly, sort }} />
      ) : (
        <EmptyState
          title={offersOnly ? "Nothing is on offer right now" : "Nothing on sale yet"}
          description="Shops add new pieces every week."
          action={offersOnly ? { label: "Show everything", href: "/shop" } : { label: "Go home", href: "/" }}
        />
      )}
    </div>
  );
}
