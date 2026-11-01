import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ShopDetailsEditor } from "@/components/org/shop-details/shop-details-editor";
import { SHOP_DETAILS_COPY } from "@/components/org/shop-details/shop-details-copy";
import { requireOrgMember } from "@/lib/org-auth";
import { shopDetailsService } from "@server/catalog/shop-details.service";
import { storefrontService } from "@server/catalog/storefront.service";
import { NotFoundError } from "@server/shared/domain-error";
import { returnHref } from "@/components/org/home/return-to";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";

/** Shop details (org-profile D2, D7): the shop's facts, the buyer part first, then the private part. */
export default async function ShopDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { orgId } = await params;
  const { from } = await searchParams;
  const scope = await requireOrgMember(orgId);
  const details = await shopDetailsService.get(scope.orgId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  return (
    <PageShell width="wide">
      <PageHeader title={SHOP_DETAILS_COPY.title} description={SHOP_DETAILS_COPY.help} />
      {/* Keyed on the version read, so "Load latest" (a refresh) remounts with the newer values. */}
      <ShopDetailsEditor
        key={`${details.updatedAt}/${details.contactUpdatedAt}`}
        orgId={scope.orgId}
        initial={details}
        oldAddressWorksUntil={storefrontService.previewChange(details.handle).oldAddressWorksUntil}
        returnTo={returnHref(scope.orgId, from, ONBOARDING_STEP.LOOK)}
      />
    </PageShell>
  );
}
