import { SectionHeader } from "@/components/shared/SectionHeader";
import { ProductGrid } from "@/components/shared/product-grid";
import { Suspense } from "react";
import { ProductGridSkeleton } from "../shared/states/LoadingSkeleton";
import { Product } from "@/domain/product";

export async function HeroProductsGrid({ heroes }: { heroes: Product[] }) {
  return (
    <section className="space-y-3 sm:space-y-4">
      <SectionHeader overline="Hero Pieces" title="Curated from the lanes" />
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductGrid products={heroes} />
      </Suspense>
    </section>
  );
}
