
import { ProductGrid } from "@/components/shared/product-grid";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { productsDAL } from "@/data-access-layer/products.dal";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/shared/states/LoadingSkeleton";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q: string }> }) {
  const { q } = await searchParams;

  const products = await productsDAL.getProducts({ search: q });

  return (
    // The (main) layout already provides the max-width container and padding.
    <div className="space-y-6">
      <SectionHeader
        overline="Search Results"
        title={`Search Results for "${q}"`}
      />
      <Suspense fallback={<ProductGridSkeleton />}>
      {products && products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState
          icon={Package}
          title="No products found"
          description="Try different keywords or browse categories"
          />
        )}
      </Suspense>
    </div>
  );
}