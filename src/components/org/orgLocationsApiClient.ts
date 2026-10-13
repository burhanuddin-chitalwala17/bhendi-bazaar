import { apiRequest } from "@/lib/api-client";
import type { OrgLocationInput } from "@/lib/validation/schemas/location.schema";
import type { OrgLocation } from "@server/catalog/org.address.types";

/** An org's pickup locations (stock-locations R1/R2/R8). */
export const orgLocationsApiClient = {
  /** Creates when `locationId` is absent, updates it otherwise. */
  save: (orgId: string, locationId: string | undefined, data: OrgLocationInput) =>
    apiRequest<OrgLocation>(
      locationId ? `/api/org/${orgId}/locations/${locationId}` : `/api/org/${orgId}/locations`,
      { method: locationId ? "PATCH" : "POST", body: data },
    ),

  remove: (orgId: string, locationId: string) =>
    apiRequest(`/api/org/${orgId}/locations/${locationId}`, { method: "DELETE" }),
};
