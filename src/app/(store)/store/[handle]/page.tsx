import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { Button } from "@/components/ui/button";
import { StorefrontHero } from "@/components/storefront/storefront-hero";
import { StorefrontTheme } from "@/components/storefront/storefront-theme";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { PRODUCT_SORTS, type ProductSort } from "@/lib/product-paging";
import { ProductSortSelect } from "@/components/shared/product-sort-select";
import { HomeHero } from "@/components/home/home-hero";
import { OffersStrip, OFFERS_IN_STRIP } from "@/components/home/offers-strip";
import { CategoryLanes } from "@/components/category/category-lanes";
import type { Product } from "@/domain/product";
import { productsDAL } from "@/data-access-layer/products.dal";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { appUrl } from "@server/shared/app-url";
import { ThemedSections } from "@/components/storefront/themed/themed-sections";
import { themedPageData } from "@/components/storefront/themed/landing-data";
import { storePreview } from "@/lib/store-preview";
import { renditionUrlForRef } from "@server/content/renditions.service";
import { resolveStorefront } from "./resolve";
import { notFound, redirect } from "next/navigation";

interface StorefrontPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{
    category?: string;
    offers?: string;
    sort?: string;
  }>;
}

/**
 * The shop names itself, not the platform (storefront-discovery R1).
 *
 * `getByHandle` is request-memoised, so this costs nothing beyond the page's own read
 * — Next calls metadata and the page separately and would otherwise ask twice.
 */
export async function generateMetadata({
  params,
}: StorefrontPageProps): Promise<Metadata> {
  const { handle } = await params;
  const shop = await storefrontDAL.getByHandle(handle);
  if (!shop) return {};

  const preview = storePreview(shop);
  const url = `${appUrl()}/store/${shop.handle}`;
  // A themed shop's link preview is its first hero photo (Q10, D14), at the one size every
  // social host agrees on; the page reads the same memoised landing page.
  const hero = shop.themeKey ? (await storefrontDAL.getStorefrontPage(handle))?.heroPhotos[0] : undefined;
  if (hero) preview.image = await renditionUrlForRef(shop.id, hero, "preview");

  return {
    title: preview.title,
    description: preview.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: preview.title,
      description: preview.description,
      url,
      ...(preview.image ? { images: [{ url: preview.image, alt: shop.name }] } : {}),
    },
  };
}

export default async function StorefrontPage({
  params,
  searchParams,
}: StorefrontPageProps) {
  const [{ handle }, query] = await Promise.all([params, searchParams]);
  const shop = await resolveStorefront(handle);

  // A shop that published a look has a landing page here and its goods at /shop (Q3); a link
  // into today's filtered grid follows the goods there (R13: no URL a shop shared breaks).
  if (shop.themeKey) {
    const filter = themedShopQuery(query);
    if (filter) redirect(`/store/${shop.handle}/shop${filter}`);
    return <ThemedLanding handle={shop.handle} />;
  }

  // Scoped by id, resolved here from the handle — the client never supplies an org
  // (ADR-0030 decision 6), so no query parameter can widen this past one shop.
  // Prices resolve through the one function the rest of the store uses, so a
  // storefront cannot advertise a price checkout would refuse.
  // Anything else in the URL is not a sort this listing has; new arrivals is what a
  // shopper gets without asking.
  const sort: ProductSort = PRODUCT_SORTS.includes(query.sort as ProductSort)
    ? (query.sort as ProductSort)
    : "newest";

  const [page, categories, promotions, offers] = await Promise.all([
    // Only the first page. The rest arrive as the shopper scrolls, through
    // /api/store/[handle]/products — one more than the page size, so the server can
    // tell the grid whether this was already the end.
    productsDAL.getPage(
      {
        orgId: shop.id,
        categorySlug: query.category,
        offerOnly: query.offers === "1",
      },
      { sort },
    ),
    storefrontDAL.categoriesFor(shop.id),
    storefrontDAL.promotionsFor(shop.id),
    // This shop's reductions, not the marketplace's — same filter, scoped.
    productsDAL.getProducts({
      orgId: shop.id,
      offerOnly: true,
      limit: OFFERS_IN_STRIP + 1,
    }),
  ]);

  const products = page.products;
  const filtering = Boolean(query.category || query.offers);

  return (
    <StorefrontTheme shop={shop}>
      <div className="space-y-8">
        {/* What the shop is running right now, in the slot the cover image used to
            hold — the same hero the platform runs, with this shop's promotions in it.
            A shared link lands here, so the top of the screen shows a campaign rather
            than a picture of the shopfront. */}
        <HomeHero banners={promotions} />

        <StorefrontHero shop={shop} />

        <section className="space-y-4">
          <CategoryLanes
            categories={categories}
            // Tapping the category already on turns it off — with the chips gone the
            // rail is the only control, so it has to be the way back to everything
            // too. The rest of the view survives the tap: a shopper who searched and
            // then picked a category has not abandoned the search.
            hrefFor={(category) =>
              `/store/${shop.handle}${storefrontQuery(query, {
                category:
                  query.category === category.slug ? null : category.slug,
              })}`
            }
            activeSlug={query.category}
          />

          <OffersStrip
            offers={offers.slice(0, OFFERS_IN_STRIP)}
            viewAll={
              offers.length > OFFERS_IN_STRIP && query.offers !== "1"
                ? {
                    // Stays on the shop and narrows the grid below, rather than sending a
                    // shopper to the marketplace's offers page and out of the storefront.
                    href: `/store/${shop.handle}${storefrontQuery(query, { offers: "1" })}`,
                    label: "View all",
                  }
                : undefined
            }
          />

          {products.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionHeader
                  overline="The shop"
                  title={
                    filtering
                      ? `Filtered — ${shop.name}`
                      : `Everything from ${shop.name}`
                  }
                />
                <div className="flex items-center gap-2">
                  {filtering && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/store/${shop.handle}`}>Clear filters</Link>
                    </Button>
                  )}
                  <ProductSortSelect basePath={`/store/${shop.handle}`} />
                </div>
              </div>
              <PaginatedProductGrid
                initial={products}
                initiallyDone={page.done}
                query={{
                  handle: shop.handle,
                  category: query.category,
                  offersOnly: query.offers === "1",
                  sort,
                }}
              />
            </>
          ) : (
            <EmptyState
              icon={Package}
              title={filtering ? "Nothing matches" : "Nothing here just yet"}
              description={
                filtering
                  ? `Try another category, or browse everything ${shop.name} sells.`
                  : `${shop.name} has not listed anything for sale. Come back soon.`
              }
            />
          )}
        </section>

        {/* R11: a visitor is never trapped in one shop. */}
        <div className="flex justify-center pt-2">
          <Button asChild variant="outline">
            <Link href="/">Browse the whole marketplace</Link>
          </Button>
        </div>
      </div>
    </StorefrontTheme>
  );
}

/** A themed shop's landing page: its theme's composition over its own data (D8, D9). */
async function ThemedLanding({ handle }: { handle: string }) {
  const page = await storefrontDAL.getStorefrontPage(handle);
  if (!page) notFound();
  return <ThemedSections theme={page.themeKey} page={themedPageData(page)} />;
}

/** Today's grid filters as the shop page names them (`offers` became `deals`, D10), or null. */
function themedShopQuery(query: { category?: string; offers?: string; sort?: string }): string | null {
  const next = new URLSearchParams();
  if (query.category) next.set("category", query.category);
  if (query.offers === "1") next.set("deals", "1");
  if (query.sort) next.set("sort", query.sort);
  const text = next.toString();
  return text ? `?${text}` : null;
}

/**
 * Rebuild the storefront's query string with one value changed.
 *
 * Declared once so every link that narrows the view keeps the rest of it: picking a
 * category must not silently discard the offers filter.
 *
 * No `sort`. Sorting by price died with pagination, and deliberately: the price a
 * shopper sees is resolved per request against the live offer set (ADR-0018), so the
 * database can only order by the list price — which puts a reduced item where its old
 * price belongs. Sorting the loaded pages client-side is worse: it reorders the first
 * twelve and then appends unsorted rows underneath. Newest-first, stable, is what the
 * query now guarantees; a real price sort needs a resolved price in a column.
 */
function storefrontQuery(
  current: { category?: string; offers?: string },
  change: Partial<Record<"category" | "offers", string | null>>,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...change })) {
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `?${query}` : "";
}
