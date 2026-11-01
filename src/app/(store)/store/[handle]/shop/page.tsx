import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { ProductSortSelect } from "@/components/shared/product-sort-select";
import { ThemedGridSkeleton } from "@/components/storefront/themed/themed-product-grid";
import { landingHref, shopHref, visitLabel } from "@/components/storefront/themed/section-heading";
import { productsDAL } from "@/data-access-layer/products.dal";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { APP_NAME } from "@/lib/config";
import { formatCount } from "@/lib/format";
import { PRODUCT_SORTS, type ProductSort } from "@/lib/product-paging";
import { cn } from "@/lib/utils";
import { COMPOSITIONS, THEMES, type ThemeKey } from "@server/catalog/storefront-themes";
import { appUrl } from "@server/shared/app-url";
import { resolveShopPage } from "../resolve";

interface ShopPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ category?: string; deals?: string; q?: string; sort?: string }>;
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const { handle } = await params;
  const shop = await storefrontDAL.getByHandle(handle);
  if (!shop?.themeKey) return {};
  return {
    title: `Shop ${shop.name}`,
    description: `Everything ${shop.name} sells on ${APP_NAME}.`,
    alternates: { canonical: `${appUrl()}${shopHref(shop.handle)}` },
  };
}

/**
 * A themed shop's goods (storefront-themes D6; Q3, ux.md shop page): the grid in the theme's card
 * and density, filtered by category, deals (`?deals=1`, the existing `offerOnly`) and a search
 * within the shop. A shop that has not published a look has no page here yet (Q35): a temporary
 * redirect to today's page, temporary because it changes on publish.
 */
export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const [{ handle }, query] = await Promise.all([params, searchParams]);
  const shop = await resolveShopPage(handle);
  const themeKey = shop.themeKey;
  if (!themeKey) redirect(landingHref(shop.handle));
  // The shop is memoised from the layout; only the goods are worth a skeleton in the theme's card.
  return (
    <Suspense
      fallback={
        <section className="mx-auto max-w-store px-gutter py-section">
          <ThemedGridSkeleton cardStyle={COMPOSITIONS[themeKey].cardStyle} columns={THEMES[themeKey].phoneColumns} />
        </section>
      }
    >
      <ShopGoods shop={{ ...shop, themeKey }} query={query} />
    </Suspense>
  );
}

async function ShopGoods({
  shop,
  query,
}: {
  shop: Awaited<ReturnType<typeof resolveShopPage>> & { themeKey: ThemeKey };
  query: Awaited<ShopPageProps["searchParams"]>;
}) {
  const sort: ProductSort = PRODUCT_SORTS.includes(query.sort as ProductSort)
    ? (query.sort as ProductSort)
    : "newest";
  const deals = query.deals === "1";
  const search = query.q?.trim().slice(0, 120) || undefined;

  // Scoped by the id resolved from the handle, never by anything in the URL (ADR-0030 D6).
  const [page, categories, total] = await Promise.all([
    productsDAL.getPage({ orgId: shop.id, categorySlug: query.category, offerOnly: deals, search }, { sort }),
    storefrontDAL.categoriesFor(shop.id),
    storefrontDAL.productCountFor(shop.id),
  ]);
  const filtering = Boolean(query.category || deals || search);
  const base = shopHref(shop.handle);
  const href = (change: { category?: string | null; deals?: boolean }) => {
    const next = new URLSearchParams();
    const category = change.category === undefined ? query.category : change.category;
    const withDeals = change.deals === undefined ? deals : change.deals;
    if (category) next.set("category", category);
    if (withDeals) next.set("deals", "1");
    if (search) next.set("q", search);
    if (sort !== "newest") next.set("sort", sort);
    const text = next.toString();
    return text ? `${base}?${text}` : base;
  };

  return (
    <section className="mx-auto max-w-store space-y-4 px-gutter py-section">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-label text-tag uppercase tracking-tag text-muted-foreground">
            {formatCount(total)} {total === 1 ? "product" : "products"}
          </p>
          <h1 className="break-words font-display text-title tracking-headline">
            {search ? `“${search}” in ${shop.name}` : shop.name}
          </h1>
        </div>
        <Link
          href={landingHref(shop.handle)}
          prefetch={false}
          className="shrink-0 font-label text-tag uppercase tracking-tag underline underline-offset-4"
        >
          {visitLabel(shop.name)}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Filter" className="no-scrollbar -mx-gutter flex gap-2 overflow-x-auto px-gutter">
          <Chip href={href({ deals: !deals })} active={deals}>Deals</Chip>
          {categories.map((category) => (
            <Chip
              key={category.slug}
              href={href({ category: query.category === category.slug ? null : category.slug })}
              active={query.category === category.slug}
            >
              {category.name}
            </Chip>
          ))}
        </nav>
        <ProductSortSelect basePath={base} />
      </div>

      {page.products.length > 0 ? (
        <PaginatedProductGrid
          initial={page.products}
          initiallyDone={page.done}
          query={{ handle: shop.handle, category: query.category, offersOnly: deals, search, sort }}
          themed={{
            shopHandle: shop.handle,
            cardStyle: COMPOSITIONS[shop.themeKey].cardStyle,
            columns: THEMES[shop.themeKey].phoneColumns,
          }}
        />
      ) : filtering ? (
        <div className="space-y-3 py-section text-center">
          <p className="text-body">Nothing here with these filters.</p>
          <Button asChild variant="outline">
            <Link href={base} prefetch={false}>Clear filters</Link>
          </Button>
        </div>
      ) : (
        <p className="py-section text-center font-display text-title">
          {shop.name} is setting up. Check back soon.
        </p>
      )}
    </section>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-field border px-3 py-1 font-label text-tag",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
