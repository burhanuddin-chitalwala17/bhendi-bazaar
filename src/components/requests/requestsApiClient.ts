import { apiRequest } from "@/lib/api-client";
import type { ReportIssueInput } from "@/lib/validation/schemas/requests.schema";

/** The shop's side of tickets (setup-requests Q7, Q24, Q36). */
export const requestsApiClient = {
  /** "Raise a request" on a listing: the server raises what it sees there (Q36). */
  raiseForListing(orgId: string, channel: string, productId: string) {
    return apiRequest<{ ok: true; raised: number }>(`/api/org/${orgId}/channels/${channel}/listings/${productId}/request`, { method: "POST" });
  },
  report(orgId: string, body: ReportIssueInput) {
    return apiRequest<{ ok: true }>(`/api/org/${orgId}/requests`, { method: "POST", body });
  },
};
