import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { adminProductTypesDAL } from "@/data-access-layer/admin/product-types.dal";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import { ProductAddContainer } from "@/components/product/console/productAdd";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { teamUploadEndpoints } from "@/lib/image/upload-endpoints";
import type { AdminCategory } from "@/domain/admin";
import { productFamilyService } from "@server/listing/product-family.service";
import { orgChannelService } from "@server/listing/org-channel.service";
import { orgAddressService } from "@server/catalog/org.address.service";

/** The Bhendi Bazaar team adding a product for a shop, in the shop's own five steps (product-form R10, D12). */
export default async function AdminNewProductForShopPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const [categoriesResult, org, allLocations, productTypes, familyRows, channels] = await Promise.all([
    adminCategoriesDAL.getCategories(),
    orgsDAL.getOrgSummary(orgId),
    orgAddressService.listLocations(orgId),
    adminProductTypesDAL.getProductTypes(),
    productFamilyService.list(orgId),
    orgChannelService.list(orgId),
  ]);
  if (!org) notFound();

  // Only active locations take new stock (stock-locations, isActive).
  const locations = allLocations
    .filter((location) => location.isActive)
    .map((location) => ({
      id: location.id,
      name: location.name,
      city: location.city,
      pincode: location.pincode,
      isActive: location.isActive,
    }));

  if (locations.length === 0) {
    // A product needs somewhere to be kept, and the address is the shop's to give (ux.md, Admin: Empty).
    return (
      <PageShell>
        <PageHeader back={{ href: `/admin/orgs/${orgId}`, label: org.name }} title="Add product for this shop" />
        <p role="status" className="rounded-card border border-warning/40 bg-warning/10 p-4 text-small text-foreground">
          {org.name} has no pickup address yet. Add one for them first.
        </p>
        {/* "Add location" waits for an admin address surface (decisions Q37); until then, back to the shop. */}
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/admin/orgs/${orgId}`}>Back to {org.name}</Link>
        </Button>
      </PageShell>
    );
  }

  const categories = categoriesResult.categories.map((c: AdminCategory) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    shotList: c.shotList,
    productType: c.productType,
  }));

  return (
    <PageShell>
      <ProductAddContainer
        categories={categories}
        productTypes={productTypes}
        families={familyRows.map((family) => ({ id: family.id, name: family.name }))}
        orgs={[{ id: org.id, name: org.name, code: org.code, handle: org.handle }]}
        locations={locations}
        sellsElsewhere={channels.some((channel) => channel.enabled)}
        uploadEndpoints={teamUploadEndpoints(orgId)}
        team={{ shopName: org.name }}
      />
    </PageShell>
  );
}
