import { apiRequest } from "@/lib/api-client";
import type { ListingDefaultsParsed } from "@/lib/validation/schemas/listing-defaults.schema";

/** Org-wide listing defaults (org-profile spec R4). */
export const orgListingDefaultsApiClient = {
  save: (orgId: string, data: ListingDefaultsParsed) =>
    apiRequest(`/api/org/${orgId}/listing-defaults`, { method: "PUT", body: data }),
  /** Whether the shop lists on Amazon as Generic (setup-requests Q35). */
  setAmazonGeneric: (orgId: string, amazonGeneric: boolean) =>
    apiRequest(`/api/org/${orgId}/listing-defaults/amazon-generic`, { method: "PUT", body: { amazonGeneric } }),
};
