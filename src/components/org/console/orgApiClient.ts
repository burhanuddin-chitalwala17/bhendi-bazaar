import { apiRequest } from "@/lib/api-client";
import type { OrgWithStats, Org } from "@/domain/org";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";
import type { Pagination } from "@/types/shared";

export interface OrgListFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: "all" | "active" | "inactive";
}

export interface OrgListResult {
  orgs: OrgWithStats[];
  pagination: Pagination;
}

const BASE_URL = "/api/admin/orgs";

/** A refused write arrives as an `ApiError` with its field details, for `useServerForm` (ADR-0013). */
export const orgApiClient = {
  getOrgs(filters: OrgListFilters = {}): Promise<OrgListResult> {
    const params = new URLSearchParams();
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.search) params.set("search", filters.search);
    if (filters.status && filters.status !== "all") params.set("status", filters.status);
    return apiRequest(`${BASE_URL}?${params.toString()}`);
  },

  createOrg(data: OrgFormInput): Promise<Org> {
    return apiRequest(BASE_URL, { method: "POST", body: data });
  },

  updateOrg(id: string, data: Partial<OrgFormInput>): Promise<Org> {
    return apiRequest(`${BASE_URL}/${id}`, { method: "PUT", body: data });
  },

  blockOrg(id: string): Promise<void> {
    return apiRequest(`${BASE_URL}/${id}`, { method: "PATCH", body: { action: "block" } });
  },

  unblockOrg(id: string): Promise<void> {
    return apiRequest(`${BASE_URL}/${id}`, { method: "PATCH", body: { action: "unblock" } });
  },
};
