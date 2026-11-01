import { orgUploadEndpoints } from "@/lib/image/upload-endpoints";
import { notFound } from "next/navigation";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { adminProductTypesDAL } from "@/data-access-layer/admin/product-types.dal";
import { productFamilyService } from "@server/listing/product-family.service";
import { orgChannelService } from "@server/listing/org-channel.service";
import { ProductAddContainer } from "@/components/product/console/productAdd";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { orgAddressService } from "@server/catalog/org.address.service";
import type { AdminCategory } from "@/domain/admin";
import { returnHref } from "@/components/org/home/return-to";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";

export default async function OrgNewProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ copyFrom?: string | string[]; from?: string | string[] }>;
}) {
  const { orgId } = await params;
  const { copyFrom, from } = await searchParams;
  // A repeated param arrives as an array; only a single id is a request to copy.
  const copyFromId = typeof copyFrom === "string" ? copyFrom : undefined;

  // Independent reads, fetched together. One org, not a list: in this portal there
  // is nothing to choose between, and offering the choice would be offering a product
  // owned by somebody else — read that org by id rather than loading every platform org.
  const [categoriesResult, org, allLocations, copyOptions, copySource, productTypes, channels] =
    await Promise.all([
      adminCategoriesDAL.getCategories(),
      orgsDAL.getOrgSummary(orgId),
      orgAddressService.listLocations(orgId),
      adminProductsDAL.getCopyOptions(orgId),
      copyFromId ? adminProductsDAL.getCopySource(copyFromId, orgId) : null,
      adminProductTypesDAL.getProductTypes(),
      orgChannelService.list(orgId),
    ]);

  // The org's families, for the picker. A product belongs to none by default, which is the
  // normal case — one abaya in one colour is one product (variants R6).
  const families = (await productFamilyService.list(orgId)).map((family) => ({
    id: family.id,
    name: family.name,
  }));

  if (!org) notFound();

  const categories = categoriesResult.categories.map((c: AdminCategory) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    shotList: c.shotList,
    // Carried so the form resolves this product's questions the same way the server does.
    productType: c.productType,
  }));

  const orgs = [
    { id: org.id, name: org.name, code: org.code, handle: org.handle },
  ];

  // Only active locations are offered for new stock; inactive ones keep their rows
  // but take no more (stock-locations, isActive).
  const locations = allLocations
    .filter((location) => location.isActive)
    .map((location) => ({
      id: location.id,
      name: location.name,
      city: location.city,
      pincode: location.pincode,
      isActive: location.isActive,
    }));

  return (
    <ProductAddContainer
      help="products"
      categories={categories}
      productTypes={productTypes}
      families={families}
      orgs={orgs}
      locations={locations}
      copySource={copySource}
      copyOptions={copyOptions}
      // A shop selling nowhere else sees no readiness line at all, not even "Checking…" (R5).
      sellsElsewhere={channels.some((channel) => channel.enabled)}
      uploadEndpoints={orgUploadEndpoints(orgId)}
      returnTo={returnHref(orgId, from, ONBOARDING_STEP.PRODUCT)}
    />
  );
}
