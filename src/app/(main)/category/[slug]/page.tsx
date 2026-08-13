import { CategoryHero } from "@/components/category/category-hero";
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

  return (
    <div className="space-y-4">
      <Suspense fallback={<LoadingSkeleton />}>
      {category && products ? (
        <>
          <CategoryHero category={category} />
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
