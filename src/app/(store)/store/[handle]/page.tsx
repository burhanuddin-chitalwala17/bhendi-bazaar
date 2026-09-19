import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";

import { ProductGrid } from "@/components/shared/product-grid";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { Button } from "@/components/ui/button";
import { StorefrontHero } from "@/components/storefront/storefront-hero";
import { HomeHero } from "@/components/home/home-hero";
import { StorefrontFilters } from "./storefront-filters";
import type { Product } from "@/domain/product";
import { productsDAL } from "@/data-access-layer/products.dal";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { appUrl } from "@server/shared/app-url";
import { resolveStorefront } from "./resolve";

interface StorefrontPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{
    q?: string;
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

  const description =
    shop.tagline ??
    shop.about?.slice(0, 160) ??
    `Shop ${shop.name} on Bhendi Bazaar.`;
  const url = `${appUrl()}/store/${shop.handle}`;

  return {
    title: shop.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: shop.name,
      description,
      url,
      ...(shop.heroUrl || shop.logoUrl
        ? {
            images: [
              { url: (shop.heroUrl ?? shop.logoUrl) as string, alt: shop.name },
            ],
          }
        : {}),
    },
  };
}

export default async function StorefrontPage({
  params,
  searchParams,
}: StorefrontPageProps) {
  const [{ handle }, query] = await Promise.all([params, searchParams]);
  const shop = await resolveStorefront(handle);

  // Scoped by id, resolved here from the handle — the client never supplies an org
  // (ADR-0030 decision 6), so no query parameter can widen this past one shop.
  // Prices resolve through the one function the rest of the store uses, so a
  // storefront cannot advertise a price checkout would refuse.
  const [products, categories, promotions] = await Promise.all([
    productsDAL.getProducts({
      orgId: shop.id,
      search: query.q,
      categorySlug: query.category,
      offerOnly: query.offers === "1",
    }),
    storefrontDAL.categoriesFor(shop.id),
    storefrontDAL.promotionsFor(shop.id),
  ]);

  const sorted = sortProducts(products, query.sort);
  const filtering = Boolean(query.q || query.category || query.offers);

  return (
    <div className="space-y-8">
      <StorefrontHero shop={shop} />

      {/* The same hero the platform runs, with this shop's promotions in it. */}
      <HomeHero banners={promotions} />

      <section className="space-y-4">
        <StorefrontFilters handle={shop.handle} categories={categories} />

        {sorted.length > 0 ? (
          <>
            <SectionHeader
              overline="The shop"
              title={
                filtering
                  ? `${sorted.length} ${sorted.length === 1 ? "item" : "items"}`
                  : `Everything from ${shop.name}`
              }
            />
            <ProductGrid products={sorted} />
          </>
        ) : (
          <EmptyState
            icon={Package}
            title={filtering ? "Nothing matches" : "Nothing here just yet"}
            description={
              filtering
                ? `Try another word, or browse everything ${shop.name} sells.`
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
  );
}

/**
 * Sorting is done here rather than in the query.
 *
 * The price a shopper sorts by is the *effective* price, which the DAL resolves per
 * request against the live offer set (ADR-0018) — the database column would sort by the
 * list price and put a discounted item in the wrong place. The listing is already
 * capped well below a page size where this matters.
 */
function sortProducts(products: Product[], sort?: string): Product[] {
  if (sort !== "price-asc" && sort !== "price-desc") return products;
  const effective = (product: Product) => product.salePrice ?? product.price;
  return [...products].sort((a, b) =>
    sort === "price-asc" ? effective(a) - effective(b) : effective(b) - effective(a)
  );
}
