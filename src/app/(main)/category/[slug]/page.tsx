import { CategoryBreadcrumb } from "@/components/category/category-breadcrumb";
import { CategoryHero } from "@/components/category/category-hero";
import { CategoryLanes } from "@/components/category/category-lanes";
import { ProductGrid } from "@/components/shared/product-grid";
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

  const category = await categoriesDAL.getCategoryBySlug(slug);
  const products = await productsDAL.getProducts({ categorySlug: slug });
  // Lanes below this one only; the trail is what points back up.
  const lanes = await categoriesDAL.getDescendants(slug);
  const ancestors = await categoriesDAL.getAncestors(slug);

  return (
    <div className="space-y-4">
      <Suspense fallback={<LoadingSkeleton />}>
      {category && products ? (
        <>
          <CategoryBreadcrumb ancestors={ancestors} current={category} />
          <CategoryHero category={category} />
          <CategoryLanes categories={lanes} />
          <ProductGrid products={products} />
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
