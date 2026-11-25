import { apiRequest } from "@/lib/api-client";
import type { InboxPrivacyDTO, SupportShareDTO } from "@server/inbox/inbox-privacy.types";
import type { SupportShareInput } from "@/lib/validation/schemas/inbox-privacy.schema";

/** The privacy sheet's and the share sheet's calls (inbox-core D9; ux steps 8 and 9). */
export const privacyApiClient = {
  log(orgId: string) {
    return apiRequest<{ privacy: InboxPrivacyDTO }>(`/api/org/${orgId}/inbox/privacy`);
  },
  share(orgId: string, conversationId: string, body: SupportShareInput) {
    return apiRequest<{ share: SupportShareDTO }>(`/api/org/${orgId}/inbox/conversations/${conversationId}/support-share`, { method: "POST", body });
  },
  stopSharing(orgId: string, conversationId: string) {
    return apiRequest<void>(`/api/org/${orgId}/inbox/conversations/${conversationId}/support-share`, { method: "DELETE" });
  },
};
