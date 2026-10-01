import { apiRequest } from "@/lib/api-client";
import type {
  EnhancementSettingsInput,
  OrgEnhancementPolicyInput,
} from "@/lib/validation/schemas/enhancement.schema";

/** The platform's image-enhancement allowances: the defaults, and one org's override. */
export const enhancementsApiClient = {
  saveSettings: (data: EnhancementSettingsInput) =>
    apiRequest("/api/admin/enhancements/settings", { method: "PUT", body: data }),

  saveOrgPolicy: (orgId: string, data: OrgEnhancementPolicyInput) =>
    apiRequest(`/api/admin/enhancements/orgs/${orgId}`, { method: "PUT", body: data }),
};
