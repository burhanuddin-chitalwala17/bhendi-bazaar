import { Suspense } from "react";
import { notFound } from "next/navigation";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { ProductEditContainer } from "@/admin/products/productEdit";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import type { AdminCategory } from "@/domain/admin";

export default async function OrgEditProductPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;
  const product = await adminProductsDAL.getProductById(id);
  if (!product || product.org.id !== orgId) notFound();

  const categories = (await adminCategoriesDAL.getCategories()).categories.map(
    (c: AdminCategory) => ({ id: c.id, name: c.name })
  );

  // The product's own org, so the form cannot reassign ownership.
  const orgs = [{ ...product.org, defaultAddress: product.org.defaultAddress ?? "" }];

  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<LoadingSkeleton />}>
        <ProductEditContainer product={product} categories={categories} orgs={orgs} />
      </Suspense>
    </div>
  );
}
