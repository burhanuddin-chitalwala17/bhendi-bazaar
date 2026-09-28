import { requireOrgMember } from "@/lib/org-auth";
import { brandService } from "@server/catalog/brand.service";
import { orgListingDefaultsService } from "@server/catalog/org-listing-defaults.service";
import { productsService } from "@server/catalog/admin.product.service";
import { BrandsManager } from "@/components/org/brands-manager";
import { ListingDefaultsForm } from "@/components/org/listing-defaults-form";

export const metadata = {
  title: "What you sell",
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
      <div>
        <h1 className="text-3xl font-bold">What you sell</h1>
        <p className="text-muted-foreground">
          The brands you carry and the facts every product starts from. Nothing here is needed
          to sell today; each fact you save is one you stop typing per product.
        </p>
      </div>
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
