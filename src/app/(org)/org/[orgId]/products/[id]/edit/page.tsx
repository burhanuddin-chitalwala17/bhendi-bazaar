import { orgUploadEndpoints } from "@/lib/image/upload-endpoints";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { ProductEditContainer } from "@/components/product/console/productEdit";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { adminProductTypesDAL } from "@/data-access-layer/admin/product-types.dal";
import { productFamilyService } from "@server/listing/product-family.service";
import type { AdminCategory } from "@/domain/admin";
import { orgAddressService } from "@server/catalog/org.address.service";
import { orgChannelService } from "@server/listing/org-channel.service";
import { brandService } from "@server/catalog/brand.service";

import { PageShell } from "@/components/shared/page-shell";
export default async function OrgEditProductPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>;
}) {
  const { orgId, id } = await params;
  const product = await adminProductsDAL.getProductById(id);
  if (!product || product.org.id !== orgId) notFound();

  const categories = (await adminCategoriesDAL.getCategories()).categories.map(
    (c: AdminCategory) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      shotList: c.shotList,
      // Carried so the form resolves this product's questions the same way the server does.
      productType: c.productType,
    }),
  );

  // The question sets, and the answers for the category this product is already in — so the
  // form opens with filled dropdowns rather than empty ones. Changing the category fetches the
  // rest ([ADR-0034]).
  const [productTypes, listingValues, familyRows, channels, brandRows] = await Promise.all([
    adminProductTypesDAL.getProductTypes(),
    adminProductTypesDAL.getValuesForCategory(product.category?.id ?? null, categories, orgId),
    productFamilyService.list(orgId),
    orgChannelService.list(orgId),
    brandService.list(orgId),
  ]);
  const brands = brandRows.map((brand) => ({ id: brand.id, name: brand.name }));
  const families = familyRows.map((family) => ({ id: family.id, name: family.name }));

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
    <PageShell>
      <Suspense fallback={<LoadingSkeleton />}>
        <ProductEditContainer
          help="products"
          product={product}
          categories={categories}
          productTypes={productTypes}
          listingValues={listingValues}
          families={families}
          brands={brands}
          orgs={orgs}
          locations={locations}
          uploadEndpoints={orgUploadEndpoints(orgId)}
          sellsElsewhere={channels.some((channel) => channel.enabled)}
        />
      </Suspense>
    </PageShell>
  );
}
