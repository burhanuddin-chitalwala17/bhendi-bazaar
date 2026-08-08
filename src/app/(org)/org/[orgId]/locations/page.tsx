import { requireOrgMember } from "@/lib/org-auth";
import { orgAddressService } from "@server/catalog/org.address.service";
import { LocationsManager } from "@/org/locations-manager";

export const metadata = { title: "Locations", robots: { index: false, follow: false } };

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
      <div>
        <h1 className="text-3xl font-bold">Pickup locations</h1>
        <p className="text-muted-foreground">
          The shops and warehouses your parcels leave from
        </p>
      </div>
      <LocationsManager orgId={scope.orgId} locations={locations} />
    </div>
  );
}
