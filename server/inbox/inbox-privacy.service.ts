import { requestService } from "@server/requests/request.service";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
import { seal } from "@server/shared/seal/seal";
import { conversationCare } from "./conversation.repository";
import { SUPPORT_SHARE_HOURS, type InboxPrivacyDTO, type SharedMessageDTO, type SupportShareDTO } from "./inbox-privacy.types";
import { sharedThread } from "./message.repository";
import { sealAccessRepository } from "./seal-access.repository";
import { supportGrantRepository, type LiveGrant } from "./support-grant.repository";

/**
 * Only the shop's members read its chats (inbox-core D9, R14, parent Q116). Support opens one chat
 * only while the shop shares it for one of its requests, for 48 hours, and every such open is logged
 * for the shop as "Who has opened your chats".
 */

const LOG_PAGE = 50;

/** A body that will not open reads as none; its row id is logged, never its text. */
function unopened(messageId: string): null {
  console.error(JSON.stringify({ scope: "inbox.support-open", messageId, reason: "sealed body did not open" }));
  return null;
}
const SHARED_MESSAGES = 200;
const HOUR_MS = 60 * 60 * 1000;

const shareOf = (grant: LiveGrant): SupportShareDTO => ({ conversationId: grant.conversationId, requestId: grant.requestId, until: grant.expiresAt.toISOString() });

async function namesOf(orgId: string, ids: readonly string[]): Promise<Map<string, string | null>> {
  const rows = await conversationCare.names(orgId, [...new Set(ids)]);
  return new Map(rows.map((row) => [row.id, row.personName ?? row.personHandle ?? row.personPhone]));
}

export const inboxPrivacy = {
  /** Share one chat with support for one of the shop's open requests, for 48 hours. */
  async share(orgId: string, userId: string, conversationId: string, requestId: string, now = new Date()): Promise<SupportShareDTO> {
    if (!(await conversationCare.ofShop(orgId, conversationId))) throw new NotFoundError("Conversation");
    if (!(await requestService.isOpenForShop(orgId, requestId))) {
      throw new DomainError("Pick one of your open requests.", { field: "requestId" });
    }
    const grant = await supportGrantRepository.create({
      orgId,
      conversationId,
      requestId,
      grantedById: userId,
      expiresAt: new Date(now.getTime() + SUPPORT_SHARE_HOURS * HOUR_MS),
    });
    return shareOf(grant);
  },

  /** Stop sharing: support can no longer open it, at once. */
  async stopSharing(orgId: string, conversationId: string, now = new Date()): Promise<void> {
    if (!(await conversationCare.ofShop(orgId, conversationId))) throw new NotFoundError("Conversation");
    await supportGrantRepository.revoke(orgId, conversationId, now);
  },

  /** "Shared with support until …" for a thread, or null. */
  async shareOf(orgId: string, conversationId: string, now = new Date()): Promise<SupportShareDTO | null> {
    const grant = await supportGrantRepository.live(conversationId, now);
    return grant && grant.orgId === orgId ? shareOf(grant) : null;
  },

  /** The privacy sheet: every open by someone not a member, newest first, and what is shared now. */
  async forShop(orgId: string, now = new Date()): Promise<InboxPrivacyDTO> {
    const [opens, grants] = await Promise.all([sealAccessRepository.forShop(orgId, LOG_PAGE), supportGrantRepository.liveForShop(orgId, now, LOG_PAGE)]);
    const names = await namesOf(orgId, [...opens.map((o) => o.conversationId), ...grants.map((g) => g.conversationId)]);
    return {
      opens: opens.map((o) => ({ id: o.id, at: o.at.toISOString(), conversationId: o.conversationId, person: names.get(o.conversationId) ?? null })),
      shares: grants.map((g) => ({ ...shareOf(g), person: names.get(g.conversationId) ?? null })),
    };
  },

  /**
   * Support's open of a shared chat (A7). The caller has proved a platform support session; this
   * proves the shop shared this chat and the share is live, and logs the open before anything is read.
   * Without a live share it is not found, so nothing says the chat exists.
   */
  async openForSupport(supportUserId: string, conversationId: string, now = new Date()): Promise<SharedMessageDTO[]> {
    const grant = await supportGrantRepository.live(conversationId, now);
    if (!grant) throw new NotFoundError("Conversation");
    await sealAccessRepository.record({ orgId: grant.orgId, conversationId, grantId: grant.id, who: supportUserId, at: now });
    const rows = await sharedThread.newest(conversationId, SHARED_MESSAGES);
    return await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        direction: row.direction,
        author: row.author,
        kind: row.kind,
        label: row.label,
        body: row.bodySealed ? await seal.open({ orgId: grant.orgId, table: "Message", rowId: row.id }, row.bodySealed).catch(() => unopened(row.id)) : null,
        sentAt: row.sentAt?.toISOString() ?? null,
      })),
    );
  },
};
