// app/(admin)/admin/products/page.tsx

import { Suspense } from "react";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { ProductsContainer } from "@/admin/products/productsList";
import { ProductsTableSkeleton } from "@/admin/products/productsList/components/ProductsTableSkeleton";
import type { Metadata } from "next";

// ⚡ ISR - Revalidate every 5 minutes
export const revalidate = 300;

// ⚡ Generate metadata for SEO
export const metadata: Metadata = {
  title: "Products Management | Admin",
  description: "Manage your product catalog",
  robots: { index: false, follow: false }, // Don't index admin pages
};

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    category?: string;
    org?: string;
    status?: string;
    sort?: string;
    order?: "asc" | "desc";
    lowStock?: string;
    outOfStock?: string;
  }>;
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Every organisation&apos;s catalogue, for support — products are managed in
            each org&apos;s own portal
          </p>
        </div>
      </div>

      {/* ⚡ Suspense for streaming */}
      <Suspense fallback={<ProductsTableSkeleton />}>
        <ProductsData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// ✅ Separate async component for data fetching
async function ProductsData({ searchParams }: ProductsPageProps) {
  const params = await searchParams;

  // Parse filters from URL
  const filters = {
    page: Number(params.page) || 1,
    limit: 10,
    search: params.search,
    categoryId: params.category,
    orgId: params.org,
    isActive:
      params.status === "active"
        ? true
        : params.status === "inactive"
        ? false
        : undefined,
    sortBy: params.sort as "name" | "createdAt" | "price" | "stock" | undefined,
    sortOrder: params.order,
    lowStock: params.lowStock === "true" ? true : undefined,
    outOfStock: params.outOfStock === "true" ? true : undefined,
  };

  // ⚡ Parallel data fetching
  const [productsData, stats, categoryList] = await Promise.all([
    adminProductsDAL.getProducts(filters),
    // null: this is the platform's cross-vendor view, so every org counts.
    adminProductsDAL.getStats(null),
    adminCategoriesDAL.getCategories(),
  ]);

  return (
    <ProductsContainer
      initialData={productsData}
      initialStats={stats}
      initialFilters={filters}
      categories={categoryList.categories}
      readOnly
    />
  );
}
