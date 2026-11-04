import { requireOrgMember } from "@/lib/org-auth";
import { orgAddressService } from "@server/catalog/org.address.service";
import { LocationsManager } from "@/components/org/locations-manager";
import { PageHeader } from "@/components/shared/page-shell";
import { returnHref } from "@/components/org/home/return-to";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";
import { ORG_PAGES_COPY } from "@/components/org/pages-copy";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";

export const metadata = {
  title: ORG_PAGE_TITLES.locations,
  robots: { index: false, follow: false },
};

export default async function OrgLocationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { orgId } = await params;
  const { from } = await searchParams;
  const scope = await requireOrgMember(orgId);
  const locations = await orgAddressService.listLocations(scope.orgId);

  return (
    <div className="space-y-6">
      <PageHeader help="locations" title={ORG_PAGES_COPY.locationsTitle} description={ORG_PAGES_COPY.locationsDescription} />
      <LocationsManager
        orgId={scope.orgId}
        locations={locations}
        returnTo={returnHref(scope.orgId, from, ONBOARDING_STEP.ADDRESS)}
      />
    </div>
  );
}
