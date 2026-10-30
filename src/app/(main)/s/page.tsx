import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { productsDAL } from "@/data-access-layer/products.dal";
import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/shared/states/LoadingSkeleton";
import type { Metadata } from "next";

// Every query is a new address; indexing them would flood the index with thin
// duplicates. Followed, so the products listed still gain from the link (seo R8).
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q: string }>;
}) {
  const { q } = await searchParams;

  const page = await productsDAL.getPage({ search: q });

  return (
    // The (main) layout already provides the max-width container and padding.
    <div className="space-y-6">
      <SectionHeader
        overline="Search Results"
        title={`Search Results for "${q}"`}
      />
      <Suspense fallback={<ProductGridSkeleton />}>
        {page.products.length > 0 ? (
          <PaginatedProductGrid
            initial={page.products}
            initiallyDone={page.done}
            query={{ search: q }}
            emptyLabel="results"
          />
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
