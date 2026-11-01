import { requireOrgMember } from "@/lib/org-auth";
import { brandService } from "@server/catalog/brand.service";
import { orgListingDefaultsService } from "@server/listing/org-listing-defaults.service";
import { productsService } from "@server/catalog/admin.product.service";
import { BrandsManager } from "@/components/org/brands-manager";
import { ListingDefaultsForm } from "@/components/org/listing-defaults-form";
import { PageHeader } from "@/components/shared/page-shell";

export const metadata = {
  title: "Brands and defaults",
  robots: { index: false, follow: false },
};

/** Onboarding step three (org-profile trd D8): the private listing context, brands and defaults. */
export default async function OrgListingContextPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const [brands, defaults, categories] = await Promise.all([
    brandService.list(scope.orgId),
    orgListingDefaultsService.get(scope.orgId),
    productsService.listCategoriesSoldBy(scope.orgId),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader help="listing" title="Brands and defaults" description="The brands you carry and the facts every product starts from. Nothing here is needed to sell today; each fact you save is one you stop typing per product." />
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Brands</h2>
        <BrandsManager orgId={scope.orgId} brands={brands} />
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Defaults</h2>
        <ListingDefaultsForm orgId={scope.orgId} defaults={defaults} categories={categories} />
      </section>
    </div>
  );
}
