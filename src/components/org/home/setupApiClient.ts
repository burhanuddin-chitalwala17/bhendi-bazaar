import { apiRequest } from "@/lib/api-client";

/** Home's setup list: hide it, bring it back, and record the first share (own-store onboarding D6). */
export const setupApiClient = {
  hide: (orgId: string) => apiRequest<{ ok: true }>(`/api/org/${orgId}/setup/hidden`, { method: "POST" }),
  show: (orgId: string) => apiRequest<{ ok: true }>(`/api/org/${orgId}/setup/hidden`, { method: "DELETE" }),
  markShared: (orgId: string) => apiRequest<{ ok: true }>(`/api/org/${orgId}/setup/shared`, { method: "POST" }),
};
