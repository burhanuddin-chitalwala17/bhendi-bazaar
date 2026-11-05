import { apiRequest } from "@/lib/api-client";
import type { RequestActionInput } from "@/lib/validation/schemas/requests.schema";
import type { PlanUnavailable, RequirementPlanDTO } from "@server/requests/request.types";

/** The admin's calls on a request (setup-requests D7, D8). */
export const adminRequestsApiClient = {
  plan(id: string) {
    return apiRequest<RequirementPlanDTO | { unavailable: PlanUnavailable }>(`/api/admin/requests/${id}`);
  },
  act(id: string, body: RequestActionInput) {
    return apiRequest<{ ok: true } | { stale: RequirementPlanDTO }>(`/api/admin/requests/${id}`, { method: "POST", body });
  },
};
