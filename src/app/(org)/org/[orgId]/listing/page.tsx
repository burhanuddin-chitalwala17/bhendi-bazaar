import { requireOrgMember } from "@/lib/org-auth";
import { brandService } from "@server/catalog/brand.service";
import { orgListingDefaultsService } from "@server/listing/org-listing-defaults.service";
import { orgChannelService } from "@server/listing/org-channel.service";
import { productsService } from "@server/catalog/admin.product.service";
import { BrandsManager } from "@/components/org/brands-manager";
import { ListingDefaultsForm } from "@/components/org/listing-defaults-form";
import { WhereYouSell } from "@/components/org/where-you-sell";
import { SectionHeader } from "@/components/shared/SectionHeader";

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
  const [brands, defaults, categories, channels] = await Promise.all([
    brandService.list(scope.orgId),
    orgListingDefaultsService.get(scope.orgId),
    productsService.listCategoriesSoldBy(scope.orgId),
    orgChannelService.list(scope.orgId),
  ]);

  return (
    <div className="space-y-8">
      <SectionHeader as="h1" title="What you sell" description="The brands you carry and the facts every product starts from. Nothing here is needed to sell today; each fact you save is one you stop typing per product." />
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Brands</h2>
        <BrandsManager orgId={scope.orgId} brands={brands} />
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Defaults</h2>
        <ListingDefaultsForm orgId={scope.orgId} defaults={defaults} categories={categories} />
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Where you sell</h2>
        <p className="text-sm text-muted-foreground">
          Turning one on starts telling you whether your products are ready for it. Nothing is
          sent anywhere yet, and leaving them all off is a complete answer.
        </p>
        <WhereYouSell orgId={scope.orgId} choices={channels} />
      </section>
    </div>
  );
}
