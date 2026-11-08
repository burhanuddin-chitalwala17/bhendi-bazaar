import { apiRequest } from "@/lib/api-client";
import type { ListingDefaultsParsed } from "@/lib/validation/schemas/listing-defaults.schema";

/** Org-wide listing defaults (org-profile spec R4). */
export const orgListingDefaultsApiClient = {
  save: (orgId: string, data: ListingDefaultsParsed) =>
    apiRequest(`/api/org/${orgId}/listing-defaults`, { method: "PUT", body: data }),
};
