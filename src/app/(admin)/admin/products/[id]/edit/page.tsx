import { Suspense } from "react";
import { notFound } from "next/navigation";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { adminProductTypesDAL } from "@/data-access-layer/admin/product-types.dal";
import { ProductEditContainer } from "@/components/product/console/productEdit";
import { ArchivedNotice } from "@/components/product/console/productEdit/ArchivedNotice";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { teamUploadEndpoints } from "@/lib/image/upload-endpoints";
import type { AdminCategory } from "@/domain/admin";
import { productFamilyService } from "@server/listing/product-family.service";
import { orgChannelService } from "@server/listing/org-channel.service";
import { orgAddressService } from "@server/catalog/org.address.service";
import { ADMIN_PRODUCTS_COPY } from "../../products-copy";
import { ROUTES } from "@server/shared/routes";

/** The Bhendi Bazaar team editing a shop's product in the shop's own form (product-form R10, D12). */
export default async function AdminEditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await adminProductsDAL.getProductById(id);
  if (!product) notFound();
  const orgId = product.org.id;
  const back = ROUTES.admin.product(id);

  if (product.archivedAt) {
    return (
      <PageShell>
        <PageHeader back={{ href: back, label: ADMIN_PRODUCTS_COPY.back }} title={ADMIN_PRODUCTS_COPY.editTitle(product.name)} />
        <ArchivedNotice productId={id} />
      </PageShell>
    );
  }

  const categories = (await adminCategoriesDAL.getCategories()).categories.map((c: AdminCategory) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    shotList: c.shotList,
    productType: c.productType,
  }));
  const [productTypes, listingValues, familyRows, channels, allLocations, formTypes] = await Promise.all([
    adminProductTypesDAL.getProductTypes(),
    adminProductTypesDAL.getValuesForCategory(product.category?.id ?? null, categories, orgId),
    productFamilyService.list(orgId),
    orgChannelService.list(orgId),
    orgAddressService.listLocations(orgId),
    adminProductTypesDAL.getFormTypes(orgId),
  ]);
  // As the shop's own edit page: an inactive location still holding this product's stock stays.
  const held = new Set(product.stockLocations.map((row) => row.orgAddressId));
  const locations = allLocations
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
          product={product}
          categories={categories}
          productTypes={formTypes}
          listingValues={listingValues}
          families={familyRows.map((family) => ({ id: family.id, name: family.name }))}
          orgs={[product.org]}
          locations={locations}
          uploadEndpoints={teamUploadEndpoints(orgId)}
          sellsElsewhere={channels.some((channel) => channel.enabled)}
          team={{ shopName: product.org.name }}
          backHref={back}
        />
      </Suspense>
    </PageShell>
  );
}
