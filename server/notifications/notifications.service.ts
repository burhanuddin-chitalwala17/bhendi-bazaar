import type { Prisma } from "@prisma/client";
import { enqueueLater, enqueueMany, type EnqueueTx } from "@server/shared/jobs/jobs.enqueue";
import { adminOrgService } from "@server/catalog/org.service";
import { profileService } from "@server/identity/profile.service";
import { appUrl } from "@server/shared/app-url";
import { ROUTES } from "@server/shared/routes";
import { deliverSpec } from "./delivery.job";
import { digestSpec, nextDigestRun } from "./digest.job";
import { KIND_VIEW } from "./kind-view";
import { memberPrefsRepository } from "./member-prefs.repository";
import { notificationRepository } from "./notification.repository";
import { NOTIFICATIONS_COPY } from "./notifications-copy";
import { renderMorningEmail } from "./templates/morningEmail";
import {
  DELIVERY_STATE,
  DELIVERY_TIMING,
  NOTIFICATION_AUDIENCE,
  emitInput,
  eventFacts,
  isParcelKind,
  type BadgeItem,
  type EmitInput,
  type EventFacts,
  type NeedsYouDTO,
  type NeedsYouRow,
  type NotificationKind,
  type StillOpen,
} from "./notification.types";
import { policyFor } from "./policy";
import { CHANNEL_PLUGS, type DeliveryEvent } from "./plugs";
import { parcelNoticeData } from "./notice.types";

type EmitTx = Pick<Prisma.TransactionClient, "notificationEvent" | "delivery"> & EnqueueTx;

/** A failed delivery is retried by its job; a settled one never is. */
const SENDABLE = [DELIVERY_STATE.PENDING, DELIVERY_STATE.FAILED] as const;
const OPEN = [DELIVERY_STATE.PENDING] as const;

/** A kind with this many open items shows as one row with its count (ux: Many items). */
export const GROUP_FROM = 3;
/** Q7: kept 13 months, then deleted in batches with a pause, so locks and replication stay light. */
const RETENTION_MONTHS = 13;
const RETENTION_BATCH = 1_000;
const RETENTION_PAUSE_MS = 200;
const DAY_SECONDS = 86_400;

interface Item {
  deliveryId: string;
  kind: NotificationKind;
  facts: EventFacts;
}

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
      {
        eventKey: event.eventKey, kind: event.kind, audience: event.audience, orgId: event.orgId, facts: event.facts,
        shipmentId: event.shipmentId ?? null,
      },
      tx,
    );
    if (!isNew) return 0;
    // Read outside `tx` on purpose: catalog's surface takes no client, and no emitter adds a member in the same transaction.
    const recipients =
      event.audience === NOTIFICATION_AUDIENCE.SHOP_MEMBERS ? await adminOrgService.listMemberIds(event.orgId) : [event.recipientRef as string];
    const rows = recipients.flatMap((recipientId) =>
      policyFor(event.kind).map((step) => ({ eventKey: event.eventKey, recipientId, channel: step.channel, timing: step.timing })),
    );
    const written = await notificationRepository.insertDeliveries(rows, tx);
    const atOnce = written.filter((d) => d.timing === DELIVERY_TIMING.AT_ONCE);
    await enqueueMany(tx, deliverSpec, atOnce.map((d) => ({ deliveryId: d.id })));
    // The morning email exists only while something waits for it: an idle hub queues nothing (Q12).
    if (written.some((d) => d.timing === DELIVERY_TIMING.DIGEST)) {
      const next = nextDigestRun(new Date());
      await enqueueLater(tx, digestSpec, { date: next.date }, { afterSeconds: next.afterSeconds, onePerSeconds: DAY_SECONDS, slot: next.date });
    }
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
    const { kind, orgId } = row.event;
    const event: DeliveryEvent = isParcelKind(kind)
      ? { kind, orgId, facts: parcelNoticeData.parse(row.event.facts) }
      : { kind: kind as NotificationKind, orgId, facts: eventFacts.parse(row.event.facts) };
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
   * Which of these items their owners say are fixed. Each kind's owner is asked once for all its items;
   * a kind with no check, or whose check throws, keeps its items: hiding one unasked could hide real work.
   */
  private async closedOf(items: readonly Item[]): Promise<Set<string>> {
    const closed = new Set<string>();
    const byKind = new Map<NotificationKind, Item[]>();
    for (const item of items) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);
    for (const [kind, group] of byKind) {
      const check = this.stillOpen.get(kind);
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
    return closed;
  }

  /**
   * The Needs you list, newest first. Items fixed meanwhile are superseded and left out, so the list
   * never holds a dead link (ux: Stale).
   */
  async needsYou(userId: string, orgId: string): Promise<BadgeItem[]> {
    const items: BadgeItem[] = (await notificationRepository.listOpenBadges(userId, orgId)).map((d) => ({
      deliveryId: d.id,
      eventKey: d.eventKey,
      kind: d.event.kind as NotificationKind,
      facts: eventFacts.parse(d.event.facts),
      at: d.at,
    }));
    const closed = await this.closedOf(items);
    await notificationRepository.supersedeBadges([...closed]);
    return items.filter((i) => !closed.has(i.deliveryId));
  }

  /** The bell's sheet: one row per item, or per kind once it piles up (ux: Many items), newest first. */
  async needsYouView(userId: string, orgId: string): Promise<NeedsYouDTO> {
    const items = await this.needsYou(userId, orgId);
    const byKind = new Map<NotificationKind, BadgeItem[]>();
    for (const item of items) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);
    const rows: NeedsYouRow[] = [];
    for (const [kind, group] of byKind) {
      const view = KIND_VIEW[kind];
      if (group.length >= GROUP_FROM) {
        const label = NOTIFICATIONS_COPY.group[view.copy];
        rows.push({ key: `kind:${kind}`, kind, title: NOTIFICATIONS_COPY.group.withCount(label, group.length), href: view.listHref(orgId), at: group[0].at.toISOString(), count: group.length });
      } else {
        for (const item of group) {
          rows.push({ key: item.deliveryId, kind, title: view.title(item.facts), href: view.href(orgId, item.facts), at: item.at.toISOString(), count: 1 });
        }
      }
    }
    rows.sort((a, b) => b.at.localeCompare(a.at));
    return { rows, count: items.length };
  }

  /** Whether this member gets the shop's morning email (D4); the badge and at-once alerts have no switch. */
  async morningEmail(userId: string, orgId: string): Promise<boolean> {
    return memberPrefsRepository.morningEmail(orgId, userId);
  }

  async setMorningEmail(userId: string, orgId: string, on: boolean): Promise<void> {
    await memberPrefsRepository.setMorningEmail(orgId, userId, on);
  }

  /**
   * The 9 am email for `date` (D4, R4): per member and shop, what still waits, grouped by kind; nothing
   * waiting, no email. Rows it covers are settled, so a second run that day sends nothing; a member who
   * turned it off has theirs skipped. A failed send leaves its rows waiting and fails the job, which retries.
   */
  async sendDigest(date: string, now = new Date()): Promise<{ emails: number; skipped: number; superseded: number }> {
    // The date's own 9 am bounds the run, so a retry covers the rows its first try did and the provider key holds.
    const nineAm = new Date(`${date}T03:30:00Z`);
    const rows = await notificationRepository.listPendingDigest(nineAm < now ? nineAm : now);
    const groups = new Map<string, { orgId: string; recipientId: string; items: Item[] }>();
    for (const row of rows) {
      const k = `${row.event.orgId}|${row.recipientId}`;
      const group = groups.get(k) ?? { orgId: row.event.orgId, recipientId: row.recipientId, items: [] };
      group.items.push({ deliveryId: row.id, kind: row.event.kind as NotificationKind, facts: eventFacts.parse(row.event.facts) });
      groups.set(k, group);
    }
    const orgIds = [...new Set([...groups.values()].map((g) => g.orgId))];
    const names = new Map((await adminOrgService.summariesFor(orgIds)).map((o) => [o.id, o.name]));
    const off = new Map<string, Set<string>>();
    for (const orgId of orgIds) {
      const members = [...groups.values()].filter((g) => g.orgId === orgId).map((g) => g.recipientId);
      off.set(orgId, await memberPrefsRepository.morningEmailOff(orgId, members));
    }

    const outcome = { emails: 0, skipped: 0, superseded: 0 };
    let failed = 0;
    for (const { orgId, recipientId, items } of groups.values()) {
      const ids = items.map((i) => i.deliveryId);
      const skip = async (reason: string) => {
        outcome.skipped += await notificationRepository.settleMany(ids, OPEN, DELIVERY_STATE.SKIPPED, { reason });
      };
      if (off.get(orgId)?.has(recipientId)) {
        await skip("morning email off");
        continue;
      }
      if (!(await adminOrgService.isMember(recipientId, orgId))) {
        await skip("no longer a member");
        continue;
      }
      const shop = names.get(orgId);
      if (!shop) {
        await skip("shop not found");
        continue;
      }
      const closed = await this.closedOf(items);
      outcome.superseded += await notificationRepository.settleMany([...closed], OPEN, DELIVERY_STATE.SUPERSEDED);
      const open = items.filter((i) => !closed.has(i.deliveryId));
      if (open.length === 0) continue;
      // Read when sending, never stored (Q7).
      const to = await profileService.findLoginEmail(recipientId);
      if (!to) {
        outcome.skipped += await notificationRepository.settleMany(open.map((i) => i.deliveryId), OPEN, DELIVERY_STATE.SKIPPED, { reason: "recipient has no email" });
        continue;
      }
      const counts = new Map<NotificationKind, number>();
      for (const item of open) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
      const rendered = renderMorningEmail({
        shop,
        lines: [...counts].map(([kind, count]) => ({
          text: NOTIFICATIONS_COPY.morning.line[KIND_VIEW[kind].copy](count),
          count,
          url: `${appUrl()}${KIND_VIEW[kind].listHref(orgId)}`,
        })),
        settingsUrl: `${appUrl()}${ROUTES.org.notifications(orgId)}`,
      });
      try {
        const { emailService } = await import("./email.service");
        const providerId = await emailService.sendDelivery({ to, ...rendered, idempotencyKey: `digest-${orgId}-${recipientId}-${date}` });
        await notificationRepository.settleMany(open.map((i) => i.deliveryId), OPEN, DELIVERY_STATE.SENT, { providerId, reason: null });
        outcome.emails += 1;
      } catch (error) {
        failed += 1;
        console.error(JSON.stringify({ scope: "notify.digest", orgId, recipientId, reason: (error instanceof Error ? error.message : "unknown error").slice(0, 200) }));
      }
    }
    if (failed > 0) throw new Error(`${failed} morning emails failed; their items still wait`);
    return outcome;
  }

  /** Events older than 13 months go, their deliveries with them (D7, Q7). Answers how many events. */
  async retention(now = new Date(), pauseMs = RETENTION_PAUSE_MS): Promise<number> {
    const cutoff = new Date(now);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);
    let events = 0;
    for (;;) {
      const deleted = await notificationRepository.deleteEventsBefore(cutoff, RETENTION_BATCH);
      events += deleted;
      if (deleted < RETENTION_BATCH) break;
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    return events;
  }
}

export const notificationsService = new NotificationsService();
