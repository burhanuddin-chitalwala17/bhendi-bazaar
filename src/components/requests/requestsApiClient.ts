import { apiRequest } from "@/lib/api-client";
import type { ReportIssueInput } from "@/lib/validation/schemas/requests.schema";

/** The shop's report (setup-requests Q7, Q24). */
export const requestsApiClient = {
  report(orgId: string, body: ReportIssueInput) {
    return apiRequest<{ ok: true }>(`/api/org/${orgId}/requests`, { method: "POST", body });
  },
};
