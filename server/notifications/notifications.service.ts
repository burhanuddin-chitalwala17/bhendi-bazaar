import type { Prisma } from "@prisma/client";
import { enqueueMany, type EnqueueTx } from "@server/shared/jobs/jobs.enqueue";
import { adminOrgService } from "@server/catalog/org.service";
import { deliverSpec } from "./delivery.job";
import { notificationRepository } from "./notification.repository";
import {
  DELIVERY_STATE,
  DELIVERY_TIMING,
  NOTIFICATION_AUDIENCE,
  emitInput,
  eventFacts,
  type BadgeItem,
  type EmitInput,
  type NotificationKind,
  type StillOpen,
} from "./notification.types";
import { DELIVERY_POLICY } from "./policy";
import { CHANNEL_PLUGS } from "./plugs";

type EmitTx = Pick<Prisma.TransactionClient, "notificationEvent" | "delivery"> & EnqueueTx;

/** A failed delivery is retried by its job; a settled one never is. */
const SENDABLE = [DELIVERY_STATE.PENDING, DELIVERY_STATE.FAILED] as const;

/**
 * The hub (ADR-0069, notifications-core): a module emits what happened, the hub decides who hears it
 * and how. Every delivery is a row first, in the emitter's transaction; only a new row is sent (hub Q3).
 */
class NotificationsService {
  private stillOpen = new Map<NotificationKind, StillOpen>();

  /**
   * Record the event and its deliveries on `tx`; enqueue the at-once ones. A repeated event key writes
   * nothing and tells nobody (R2). Answers how many deliveries were written.
   */
  async emit(tx: EmitTx, input: EmitInput): Promise<number> {
    const event = emitInput.parse(input);
    const isNew = await notificationRepository.insertEventOnce(
      { eventKey: event.eventKey, kind: event.kind, audience: event.audience, orgId: event.orgId, facts: event.facts },
      tx,
    );
    if (!isNew) return 0;
    // Read outside `tx` on purpose: catalog's surface takes no client, and no emitter adds a member in the same transaction.
    const recipients =
      event.audience === NOTIFICATION_AUDIENCE.BUYER ? [event.recipientRef as string] : await adminOrgService.listMemberIds(event.orgId);
    const rows = recipients.flatMap((recipientId) =>
      DELIVERY_POLICY[event.kind].map((step) => ({ eventKey: event.eventKey, recipientId, channel: step.channel, timing: step.timing })),
    );
    const written = await notificationRepository.insertDeliveries(rows, tx);
    const atOnce = written.filter((d) => d.timing === DELIVERY_TIMING.AT_ONCE);
    await enqueueMany(tx, deliverSpec, atOnce.map((d) => ({ deliveryId: d.id })));
    return written.length;
  }

  /**
   * Send one delivery through its channel's plug. Settled rows are skipped; the row id is the provider's
   * idempotency key, so a twin job cannot email twice. A throw is recorded, without a body, then rethrown.
   */
  async deliver(deliveryId: string): Promise<void> {
    const row = await notificationRepository.findDelivery(deliveryId);
    if (!row || !(SENDABLE as readonly string[]).includes(row.state)) return;
    const plug = CHANNEL_PLUGS[row.channel as keyof typeof CHANNEL_PLUGS];
    if (!plug) return;
    const event = { kind: row.event.kind as NotificationKind, orgId: row.event.orgId, facts: eventFacts.parse(row.event.facts) };
    try {
      const outcome = await plug.deliver({ id: row.id, recipientId: row.recipientId, event });
      if (!outcome) return;
      if (outcome.state === DELIVERY_STATE.SENT) {
        await notificationRepository.settle(row.id, SENDABLE, DELIVERY_STATE.SENT, { providerId: outcome.providerId, reason: null });
      } else {
        await notificationRepository.settle(row.id, SENDABLE, DELIVERY_STATE.SKIPPED, { reason: outcome.reason });
      }
    } catch (error) {
      const reason = (error instanceof Error ? error.message : "unknown error").slice(0, 200);
      console.error(JSON.stringify({ scope: "notify.deliver", deliveryId: row.id, kind: event.kind, channel: row.channel, reason }));
      await notificationRepository.settle(row.id, SENDABLE, DELIVERY_STATE.FAILED, { reason }).catch(() => undefined);
      throw error;
    }
  }

  /** An emitting module answers, for its kind, whether each item still needs the shop (D3). */
  registerStillOpen(kind: NotificationKind, check: StillOpen): void {
    this.stillOpen.set(kind, check);
  }

  /** The member's unread count for this shop: one indexed count, no owner asked (D3). */
  async badgeCount(userId: string, orgId: string): Promise<number> {
    return notificationRepository.countOpenBadges(userId, orgId);
  }

  /**
   * The Needs you list, newest first. Each kind's owner is asked once for all its items; those fixed
   * meanwhile are superseded and left out, so the list never holds a dead link (ux: Stale).
   */
  async needsYou(userId: string, orgId: string): Promise<BadgeItem[]> {
    const items: BadgeItem[] = (await notificationRepository.listOpenBadges(userId, orgId)).map((d) => ({
      deliveryId: d.id,
      eventKey: d.eventKey,
      kind: d.event.kind as NotificationKind,
      facts: eventFacts.parse(d.event.facts),
      at: d.at,
    }));
    const closed = new Set<string>();
    const byKind = new Map<NotificationKind, BadgeItem[]>();
    for (const item of items) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);
    for (const [kind, group] of byKind) {
      const check = this.stillOpen.get(kind);
      // A kind whose owner has not registered keeps its items: hiding one unasked could hide real work.
      if (!check) continue;
      // One owner down keeps its own items rather than blanking the whole sheet.
      const open = await check(group.map((i) => i.facts)).catch((error: unknown) => {
        console.error(JSON.stringify({ scope: "notify.still-open", kind, reason: error instanceof Error ? error.message : "unknown" }));
        return group.map(() => true);
      });
      group.forEach((item, n) => {
        if (open[n] === false) closed.add(item.deliveryId);
      });
    }
    await notificationRepository.supersedeBadges([...closed]);
    return items.filter((i) => !closed.has(i.deliveryId));
  }
}

export const notificationsService = new NotificationsService();
