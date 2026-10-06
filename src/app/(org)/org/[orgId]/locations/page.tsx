import { requireOrgMember } from "@/lib/org-auth";
import { orgAddressService } from "@server/catalog/org.address.service";
import { LocationsManager } from "@/components/org/locations-manager";
import { SectionHeader } from "@/components/shared/SectionHeader";

export const metadata = {
  title: "Locations",
  robots: { index: false, follow: false },
};

export default async function OrgLocationsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const locations = await orgAddressService.listLocations(scope.orgId);

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" title="Pickup locations" description="The shops and warehouses your parcels leave from" />
      <LocationsManager orgId={scope.orgId} locations={locations} />
    </div>
  );
}
