import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { ProductsContainer } from "@/admin/products/productsList";
import { ProductsTableSkeleton } from "@/admin/products/productsList/components/ProductsTableSkeleton";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    category?: string;
    sort?: string;
    order?: "asc" | "desc";
    lowStock?: string;
    outOfStock?: string;
  }>;
}

export default async function OrgProductsPage({ params, searchParams }: PageProps) {
  const { orgId } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">Your organisation&apos;s catalogue</p>
        </div>
        <Button asChild>
          <Link href={`/org/${orgId}/products/new`}>
            <Plus className="h-4 w-4" />
            New Product
          </Link>
        </Button>
      </div>

      <Suspense fallback={<ProductsTableSkeleton />}>
        <OrgProductsData orgId={orgId} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrgProductsData({
  orgId,
  searchParams,
}: {
  orgId: string;
  searchParams: PageProps["searchParams"];
}) {
  const params = await searchParams;

  // `orgId` comes from the path, never the query string — a filter the caller controls
  // could otherwise widen this to another org's catalogue.
  const filters = {
    orgId,
    page: Number(params.page) || 1,
    limit: 10,
    search: params.search,
    categoryId: params.category,
    sortBy: params.sort as "name" | "createdAt" | "price" | "stock" | undefined,
    sortOrder: params.order,
    lowStock: params.lowStock === "true" ? true : undefined,
    outOfStock: params.outOfStock === "true" ? true : undefined,
  };

  const [productsData, stats] = await Promise.all([
    adminProductsDAL.getProducts(filters),
    adminProductsDAL.getStats(orgId),
  ]);

  return (
    <ProductsContainer
      initialData={productsData}
      initialStats={stats}
      initialFilters={filters}
    />
  );
}
