import { notificationsService } from "@server/notifications/notifications.service";
import { NOTIFICATION_AUDIENCE, NOTIFICATION_KIND, type EventFacts } from "@server/notifications/notification.types";
import { NotFoundError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import { conversationCare } from "./conversation.repository";
import { WAITING_MS, retentionDaily, waitingAfterArrival, waitingBacklog } from "./inbox-care.job";
import type { NeedsYouReason } from "./inbox.types";

/**
 * Needs you and the waiting event (inbox-core D5, R4a, R10). The inbox says only that a conversation
 * has waited four hours; the hub decides who is told and how (parent Q66). One event per thread per
 * waiting spell (decisions Q19).
 */

const BATCH = 200;
/** A sweep's ceiling, so a backlog is worked through by the next run rather than one endless one. */
const MAX_BATCHES = 50;

export const inboxWaiting = {
  /**
   * An automatic reply hands the thread to the shop, or could not answer it (D5). Called by
   * automations; a member's send clears it (D6).
   */
  async markNeedsYou(conversationId: string, reason: NeedsYouReason, now = new Date()): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const marked = await conversationCare.markNeedsYou(tx, conversationId, reason);
      if (!marked) throw new NotFoundError("Conversation");
      if (marked.lastInboundAt) await waitingAfterArrival(tx, marked.lastInboundAt, now);
    });
  },

  /** Emits `conversation waiting` for every thread waiting four hours and not yet told about; then sleeps until the next is due. */
  async sweep(now = new Date()): Promise<{ emitted: number }> {
    const cutoff = new Date(now.getTime() - WAITING_MS);
    let emitted = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const claimed = await prisma.$transaction(async (tx) => {
        const rows = await conversationCare.claimWaiting(tx, cutoff, now, BATCH);
        for (const row of rows) {
          await notificationsService.emit(tx, {
            kind: NOTIFICATION_KIND.CONVERSATION_WAITING,
            orgId: row.orgId,
            audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS,
            facts: { conversationId: row.id, platform: row.platform },
            eventKey: `conversation-waiting:${row.id}:${now.getTime()}`,
          });
        }
        return rows.length;
      });
      emitted += claimed;
      if (claimed < BATCH) break;
    }
    const next = await conversationCare.nextWaiting();
    // A backlog past the ceiling is already due: a fresh slot, so the queue never refuses it as this run's twin.
    if (next && next <= cutoff) await waitingBacklog(prisma, now);
    else if (next) await waitingAfterArrival(prisma, next, now);
    // Retention needs no schedule slot: the sweep restarts its daily chain should a run ever be lost (D10).
    await retentionDaily(prisma, 0);
    return { emitted };
  },

  /** For the hub's Needs you list (notifications-core D3): a thread still waits while it needs the shop or is unread. */
  async stillWaiting(facts: EventFacts[]): Promise<boolean[]> {
    const rows = await conversationCare.waitingState(facts.map((f) => f.conversationId ?? ""));
    const open = new Map(rows.map((row) => [row.id, row.needsYou || row.unread]));
    return facts.map((f) => open.get(f.conversationId ?? "") ?? false);
  },
};
