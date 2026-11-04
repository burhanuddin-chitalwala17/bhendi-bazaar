import { Suspense } from "react";

import { CategoryArches } from "@/components/category/category-arches";
import { HEROES_FIRST_PAGE, HeroProductsGrid } from "@/components/home/hero-products-grid";
import { HomeHero } from "@/components/home/home-hero";
import { OffersStrip, OFFERS_IN_STRIP } from "@/components/home/offers-strip";
import { TrustRow } from "@/components/home/trust-row";
import { ProductGrid, SkeletonProductGrid } from "@/components/shared/product-grid";
import { SectionHeader } from "@/components/shared/SectionHeader";

import { bannersDAL } from "@/data-access-layer/banners.dal";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { productsDAL } from "@/data-access-layer/products.dal";
import { formatCount } from "@/lib/format";
import { APP_DESCRIPTION, APP_NAME, BRAND_PROFILES } from "@/lib/config";
import { JsonLd } from "@/components/shared/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";
import { appUrl } from "@server/shared/app-url";
import { HOME_PAGE_COPY } from "./home-page-copy";
import { ROUTES } from "@server/shared/routes";

/** One row of the desktop's 4-up grid, two of the phone's. */
const NEW_IN = 4;

function isTopLevel(category: { parentId: string | null }) {
  return category.parentId === null;
}

/** Top-level categories in the order the admin set. */
function byAdminOrder(a: { order: number }, b: { order: number }) {
  return a.order - b.order;
}

export default async function HomePage() {
  // Independent reads, together. The whole category tree because home has no ancestor to descend from.
  const [banners, offers, lanes] = await Promise.all([
    bannersDAL.getActiveBanners(),
    // One more than the strip shows: the extra row says whether to offer the rest.
    productsDAL.getOfferProducts(OFFERS_IN_STRIP + 1),
    categoriesDAL.getDescendants(null),
  ]);

  const topLevel = lanes.filter(isTopLevel).sort(byAdminOrder);

  return (
    <div className="space-y-8 md:space-y-12">
      <JsonLd data={[organizationJsonLd(appUrl(), BRAND_PROFILES), websiteJsonLd(appUrl())]} />
      <h1 className="sr-only">
        {APP_NAME} — {APP_DESCRIPTION}
      </h1>
      <HomeHero banners={banners} />
      <CategoryArches categories={topLevel} />
      <OffersStrip
        offers={offers.slice(0, OFFERS_IN_STRIP)}
        viewAll={offers.length > OFFERS_IN_STRIP ? { href: ROUTES.offers, label: HOME_PAGE_COPY.offersMore } : undefined}
      />
      {/* Below the fold: streamed, so the hero paints without waiting for either grid. */}
      <Suspense fallback={<SkeletonProductGrid count={NEW_IN} />}>
        <NewIn />
      </Suspense>
      <Suspense fallback={<SkeletonProductGrid count={NEW_IN} />}>
        <Heroes />
      </Suspense>
      <TrustRow />
    </div>
  );
}

async function NewIn() {
  // The count is the cached listing count: one read, no fresher than the grid it sits over.
  const [{ products }, total] = await Promise.all([productsDAL.getPage({}, { limit: NEW_IN }), productsDAL.countListing({})]);
  if (products.length === 0) return null;
  return (
    <section className="space-y-4">
      <SectionHeader
        title={HOME_PAGE_COPY.newTitle}
        description={HOME_PAGE_COPY.newDescription}
        action={{ label: total > products.length ? HOME_PAGE_COPY.seeAllCount(formatCount(total)) : HOME_PAGE_COPY.seeAll, href: ROUTES.shopAll }}
      />
      <ProductGrid products={products} />
    </section>
  );
}

async function Heroes() {
  const heroes = await productsDAL.getPage({ heroOnly: true }, { limit: HEROES_FIRST_PAGE });
  return <HeroProductsGrid heroes={heroes.products} done={heroes.done} />;
}
