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
import { SHOP_PAGE_COPY } from "./shop-page-copy";
import { ROUTES } from "@server/shared/routes";

export const metadata: Metadata = {
  title: SHOP_PAGE_COPY.title,
  description: SHOP_PAGE_COPY.metaDescription,
  alternates: { canonical: `${appUrl()}${ROUTES.shopAll}` },
};

const FILTERS: ListingFilter[] = [{ label: SHOP_PAGE_COPY.onOfferFilter, param: "offers", value: "1" }];

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
      <PageHeader title={SHOP_PAGE_COPY.title} description={SHOP_PAGE_COPY.description} />
      <CategoryLanes categories={categories} />
      <Link
        href={ROUTES.stores}
        prefetch={false}
        className="flex min-h-12 items-center gap-3 rounded-card border border-border bg-card px-4 py-3 transition-colors duration-fast hover:bg-muted"
      >
        <Icon name="shop" size="lg" tone="primary" />
        <span className="flex-1">
          <span className="block text-small font-semibold text-foreground">{SHOP_PAGE_COPY.byShop}</span>
          <span className="block text-caption text-muted-foreground">{SHOP_PAGE_COPY.byShopDetail}</span>
        </span>
        <Icon name="next" size="sm" tone="muted" />
      </Link>
      <ListingToolbar
        basePath={ROUTES.shopAll}
        params={{ sort: sort === "newest" ? undefined : sort, offers: offersOnly ? "1" : undefined }}
        count={count}
        filters={FILTERS}
      />
      {page.products.length > 0 ? (
        <PaginatedProductGrid initial={page.products} initiallyDone={page.done} query={{ offersOnly, sort }} />
      ) : (
        <EmptyState
          title={offersOnly ? SHOP_PAGE_COPY.noOffersTitle : SHOP_PAGE_COPY.emptyTitle}
          description={SHOP_PAGE_COPY.emptyBody}
          action={offersOnly ? { label: SHOP_PAGE_COPY.showEverything, href: ROUTES.shopAll } : { label: SHOP_PAGE_COPY.goHome, href: ROUTES.home }}
        />
      )}
    </div>
  );
}
