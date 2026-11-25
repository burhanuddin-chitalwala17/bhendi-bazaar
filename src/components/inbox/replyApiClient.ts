import { apiRequest } from "@/lib/api-client";
import type { SentReplyDTO, UndoneReplyDTO } from "@server/inbox/inbox-send.types";
import type { ReplyInput } from "@/lib/validation/schemas/inbox-reply.schema";

/** The reply box's calls (inbox-core D6): send holds 7 s, Undo takes it back, Try again re-queues a failed one. */
export const replyApiClient = {
  send(orgId: string, conversationId: string, body: ReplyInput) {
    return apiRequest<{ message: SentReplyDTO }>(`/api/org/${orgId}/inbox/conversations/${conversationId}/messages`, { method: "POST", body });
  },
  undo(orgId: string, messageId: string) {
    return apiRequest<{ reply: UndoneReplyDTO }>(`/api/org/${orgId}/inbox/messages/${messageId}/undo`, { method: "POST" });
  },
  retry(orgId: string, messageId: string) {
    return apiRequest<{ message: SentReplyDTO }>(`/api/org/${orgId}/inbox/messages/${messageId}/retry`, { method: "POST" });
  },
};
