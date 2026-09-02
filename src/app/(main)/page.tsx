import { CategoryLanes } from "@/components/category/category-lanes";
import { HeroProductsGrid } from "@/components/home/hero-products-grid";
import { HomeHero } from "@/components/home/home-hero";
import { OffersStrip } from "@/components/home/offers-strip";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { bannersDAL } from "@/data-access-layer/banners.dal";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { productsDAL } from "@/data-access-layer/products.dal";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import { Suspense } from "react";

export default async function HomePage() {
  // Four independent reads — fetched together, not in a four-step waterfall. The whole
  // category tree because home is the one page with no ancestor to descend from.
  const [banners, heroes, offers, lanes] = await Promise.all([
    bannersDAL.getActiveBanners(),
    productsDAL.getHeroProducts(6),
    productsDAL.getOfferProducts(4),
    categoriesDAL.getDescendants(null),
  ]);
  return (
    <div className="space-y-8 sm:space-y-10">
      <h1 className="sr-only">{APP_NAME} — {APP_DESCRIPTION}</h1>
      <CategoryLanes categories={lanes} />
      <HomeHero banners={banners} />
      <Suspense fallback={<LoadingSkeleton />}>
        <OffersStrip offers={offers} />
      </Suspense>
      <Suspense fallback={<LoadingSkeleton />}>
        <HeroProductsGrid heroes={heroes} />
      </Suspense>
    </div>
  );
}
