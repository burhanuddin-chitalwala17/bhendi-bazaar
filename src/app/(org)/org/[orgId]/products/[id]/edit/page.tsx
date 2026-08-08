import { Suspense } from "react";
import { notFound } from "next/navigation";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { ProductEditContainer } from "@/admin/products/productEdit";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import type { AdminCategory } from "@/domain/admin";
import { orgAddressService } from "@server/catalog/org.address.service";

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
  const orgs = [product.org];

  // Active locations, plus any inactive one that still holds this product's stock —
  // hiding it would silently zero the row on the next save.
  const held = new Set(product.stockLocations.map((row) => row.orgAddressId));
  const locations = (await orgAddressService.listLocations(orgId))
    .filter((location) => location.isActive || held.has(location.id))
    .map((location) => ({
      id: location.id,
      name: location.name,
      city: location.city,
      pincode: location.pincode,
      isActive: location.isActive,
    }));

  return (
    <div className="mx-auto max-w-5xl">
      <Suspense fallback={<LoadingSkeleton />}>
        <ProductEditContainer
          product={product}
          categories={categories}
          orgs={orgs}
          locations={locations}
        />
      </Suspense>
    </div>
  );
}
