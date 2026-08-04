// app/(admin)/admin/products/page.tsx

import { Suspense } from "react";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { ProductsContainer } from "@/admin/products/productsList";
import { ProductsTableSkeleton } from "@/admin/products/productsList/components/ProductsTableSkeleton";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

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
    seller?: string;
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
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="w-4 h-4" />
            New Product
          </Link>
        </Button>
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
    sellerId: params.seller,
    isActive:
      params.status === "active"
        ? true
        : params.status === "inactive"
        ? false
        : undefined,
    sortBy: params.sort as any,
    sortOrder: params.order,
    lowStock: params.lowStock === "true" ? true : undefined,
    outOfStock: params.outOfStock === "true" ? true : undefined,
  };

  // ⚡ Parallel data fetching
  const [productsData, stats] = await Promise.all([
    adminProductsDAL.getProducts(filters),
    adminProductsDAL.getStats(),
  ]);

  return (
    <ProductsContainer
      initialData={productsData}
      initialStats={stats}
      initialFilters={filters}
    />
  );
}
