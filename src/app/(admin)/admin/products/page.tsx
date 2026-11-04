import { Suspense } from "react";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { ProductsContainer } from "@/components/product/console/productsList";
import { ProductsTableSkeleton } from "@/components/product/console/productsList/components/ProductsTableSkeleton";
import type { Metadata } from "next";
import { resolvePageNumber, resolvePageSize } from "@server/shared/pagination";
import { PageHeader, PageShell } from "@/components/shared/page-shell";

// No `revalidate`: the page reads its searchParams and sits behind the admin session, so it is
// rendered per request and an ISR window never applied to it.
export const metadata: Metadata = {
  title: "Admin: products",
  description: "Manage your product catalog",
  robots: { index: false, follow: false }
};

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    category?: string;
    org?: string;
    status?: string;
    sort?: string;
    order?: "asc" | "desc";
    lowStock?: string;
    outOfStock?: string;
    wishlisted?: string;
  }>;
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  return (
    <PageShell width="wide">
      <PageHeader title="Products" description="Every shop's catalogue, for support. Shops manage their products in their own portal." />

      <Suspense fallback={<ProductsTableSkeleton />}>
        <ProductsData searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function ProductsData({ searchParams }: ProductsPageProps) {
  const params = await searchParams;

  // Parse filters from URL
  const filters = {
    page: resolvePageNumber(params.page),
    limit: resolvePageSize(params.limit),
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
    wishlistedOnly: params.wishlisted === "true" ? true : undefined,
  };

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
