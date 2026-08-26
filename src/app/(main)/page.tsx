import { CategorySections } from "@/components/home/category-sections";
import { HeroProductsGrid } from "@/components/home/hero-products-grid";
import { OffersStrip } from "@/components/home/offers-strip";
import { HomeHero } from "@/components/home/home-hero";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { productsDAL } from "@/data-access-layer/products.dal";
import { Suspense } from "react";

export default async function HomePage() {
  const heroes = await productsDAL.getHeroProducts(6);
  const offers = await productsDAL.getOfferProducts(4);
  const categories = await categoriesDAL.getCategories();
  return (
    <div className="space-y-8 sm:space-y-10">
      <Suspense fallback={<LoadingSkeleton />}>
        <OffersStrip offers={offers} />
      </Suspense>
      <HomeHero />
      <Suspense fallback={<LoadingSkeleton />}>
        <HeroProductsGrid heroes={heroes} />
      </Suspense>
      <Suspense fallback={<LoadingSkeleton />}>
        <CategorySections categories={categories} />
      </Suspense>
    </div>
  );
}


