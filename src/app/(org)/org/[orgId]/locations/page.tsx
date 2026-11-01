import { requireOrgMember } from "@/lib/org-auth";
import { orgAddressService } from "@server/catalog/org.address.service";
import { LocationsManager } from "@/components/org/locations-manager";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { returnHref } from "@/components/org/home/return-to";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";

export const metadata = {
  title: "Pickup addresses",
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
      <SectionHeader as="h1" title="Pickup addresses" description="Where couriers collect from" />
      <LocationsManager
        orgId={scope.orgId}
        locations={locations}
        returnTo={returnHref(scope.orgId, from, ONBOARDING_STEP.ADDRESS)}
      />
    </div>
  );
}
