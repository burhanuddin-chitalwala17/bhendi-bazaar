import { CategoryBreadcrumb } from "@/components/category/category-breadcrumb";
import { CategoryHero } from "@/components/category/category-hero";
import { CategoryLanes } from "@/components/category/category-lanes";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { PRODUCT_PAGE_SIZE } from "@/lib/product-paging";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { Package } from "lucide-react";
import { productsDAL } from "@/data-access-layer/products.dal";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  // Independent reads, fetched together rather than in a four-step waterfall. The three
  // category shapes all resolve against the same request-memoised tree, so they add no
  // queries; lanes are below this one only, and the ancestor trail points back up.
  const [category, products, lanes, ancestors] = await Promise.all([
    categoriesDAL.getCategoryBySlug(slug),
    productsDAL.getProducts({ categorySlug: slug, limit: PRODUCT_PAGE_SIZE }),
    categoriesDAL.getDescendants(slug),
    categoriesDAL.getAncestors(slug),
  ]);

  return (
    <div className="space-y-4">
      <Suspense fallback={<LoadingSkeleton />}>
        {category && products ? (
          <>
            <CategoryBreadcrumb ancestors={ancestors} current={category} />
            <CategoryHero category={category} />
            <CategoryLanes categories={lanes} />
            <PaginatedProductGrid
              initial={products}
              initiallyDone={products.length < PRODUCT_PAGE_SIZE}
              query={{ category: slug }}
            />
          </>
        ) : (
          <EmptyState
            icon={Package}
            title="No category or products found"
            description="Try different keywords or browse categories"
          />
        )}
      </Suspense>
    </div>
  );
}
