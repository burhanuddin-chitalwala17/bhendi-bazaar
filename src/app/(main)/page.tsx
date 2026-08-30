import { CategoryLanes } from "@/components/category/category-lanes";
import { HeroProductsGrid } from "@/components/home/hero-products-grid";
import { HomeHero } from "@/components/home/home-hero";
import { OffersStrip } from "@/components/home/offers-strip";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { productsDAL } from "@/data-access-layer/products.dal";
import { Suspense } from "react";

export default async function HomePage() {
  const heroes = await productsDAL.getHeroProducts(6);
  const offers = await productsDAL.getOfferProducts(4);
  // The whole tree — home is the one page with no ancestor to descend from.
  const lanes = await categoriesDAL.getDescendants(null);
  return (
    <div className="space-y-8 sm:space-y-10">
      <CategoryLanes categories={lanes} />
      <HomeHero />
      <Suspense fallback={<LoadingSkeleton />}>
        <OffersStrip offers={offers} />
      </Suspense>
      <Suspense fallback={<LoadingSkeleton />}>
        <HeroProductsGrid heroes={heroes} />
      </Suspense>
    </div>
  );
}
