/**
 * Admin Edit Product Page
 * Edit an existing product
 */
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { ProductEditContainer } from "@/admin/products/productEdit";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { Suspense } from "react";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import type { OrgWithStats } from "@/domain/org";
import type { AdminCategory } from "@/domain/admin";
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await adminProductsDAL.getProductById(id);
  const categories = (await adminCategoriesDAL.getCategories()).categories.map((c: AdminCategory) => ({
    id: c.id,
    name: c.name,
  }));
  const orgs = (await orgsDAL.getOrgs()).map((s: OrgWithStats) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    defaultPincode: s.defaultPincode,
    defaultCity: s.defaultCity,
    defaultState: s.defaultState,
    defaultAddress: s.defaultAddress ?? "",
  }));

  return (
    <div className="max-w-5xl mx-auto">
      <Suspense fallback={<LoadingSkeleton />}>
        <ProductEditContainer product={product} categories={categories} orgs={orgs} />
      </Suspense>
    </div>
  );
}

