import { requireOrgMember } from "@/lib/org-auth";
import { brandService } from "@server/catalog/brand.service";
import { orgListingDefaultsService } from "@server/listing/org-listing-defaults.service";
import { productsService } from "@server/catalog/admin.product.service";
import { BrandsManager } from "@/components/org/brands-manager";
import { ListingDefaultsForm } from "@/components/org/listing-defaults-form";
import { PageHeader } from "@/components/shared/page-shell";
import { ORG_PAGES_COPY } from "@/components/org/pages-copy";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";

export const metadata = {
  title: ORG_PAGE_TITLES.brands,
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
      <PageHeader help="listing" title={ORG_PAGES_COPY.listingTitle} description={ORG_PAGES_COPY.listingDescription} />
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{ORG_PAGES_COPY.brands}</h2>
        <BrandsManager orgId={scope.orgId} brands={brands} />
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{ORG_PAGES_COPY.defaults}</h2>
        <ListingDefaultsForm orgId={scope.orgId} defaults={defaults} categories={categories} />
      </section>
    </div>
  );
}
