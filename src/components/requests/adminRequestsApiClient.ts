import { apiRequest } from "@/lib/api-client";
import type { RequestActionInput } from "@/lib/validation/schemas/requests.schema";
import type { PlanBase, PlanUnavailableDTO } from "@server/requests/request.types";

/** The admin's calls on a request (setup-requests D7, D8). A plan's shape is its kind's; this carries it. */
export const adminRequestsApiClient = {
  plan<P extends PlanBase>(id: string) {
    return apiRequest<P | PlanUnavailableDTO>(`/api/admin/requests/${id}`);
  },
  act<P extends PlanBase>(id: string, body: RequestActionInput) {
    return apiRequest<{ ok: true } | { stale: P }>(`/api/admin/requests/${id}`, { method: "POST", body });
  },
};
