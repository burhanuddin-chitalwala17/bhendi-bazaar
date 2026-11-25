/**
 * The notifications hub against a real database (notification-hub/notifications-core unit 1, D1–D3, D5):
 * an event raises a badge for every member once, a repeat tells nobody twice, an at-once kind is
 * emailed by the job it enqueued, and a badge item whose subject was fixed leaves the list.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureFixtures, ensureOrgMember, isDisposableDb } from "../helpers/test-db";

const RUN = Date.now();

describe.skipIf(!isDisposableDb)("notifications hub (local db)", () => {
  let orgId = "";
  let owner = "";
  let second = "";
  const keys: string[] = [];
  const key = (name: string) => {
    const k = `test:${name}:${RUN}`;
    keys.push(k);
    return k;
  };

  beforeAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    ({ orgId, userId: owner } = await ensureFixtures());
    await ensureOrgMember(orgId, owner);
    second = (await prisma.user.create({ data: { email: `hub-${RUN}@example.invalid` }, select: { id: true } })).id;
    await ensureOrgMember(orgId, second);
  });

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { JOBS_SCHEMA, JOBS_QUEUE } = await import("@server/shared/jobs/jobs.config");
    const ids = (await prisma.delivery.findMany({ where: { eventKey: { in: keys } }, select: { id: true } })).map((d) => d.id);
    await prisma.$executeRawUnsafe(
      `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'deliveryId' = ANY($2)`,
      JOBS_QUEUE,
      ids,
    );
    await prisma.notificationEvent.deleteMany({ where: { eventKey: { in: keys } } });
    const made = { email: { startsWith: "hub-", endsWith: `-${RUN}@example.invalid` } };
    await prisma.orgMember.deleteMany({ where: { user: made } });
    await prisma.user.deleteMany({ where: made });
  });

  const emit = async (input: Parameters<typeof import("@server/notifications/notifications.service").notificationsService.emit>[1]) => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    return prisma.$transaction((tx) => notificationsService.emit(tx, input));
  };

  const jobsFor = async (deliveryId: string) => {
    const { prisma } = await import("@server/shared/prisma");
    const { JOBS_SCHEMA, JOBS_QUEUE } = await import("@server/shared/jobs/jobs.config");
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'notify.deliver' AND data->'payload'->>'deliveryId' = $2`,
      JOBS_QUEUE,
      deliveryId,
    );
    return Number(rows[0].n);
  };

  it("A1: a connection needing the shop raises the badge for every member at once, and emails nobody yet", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { NOTIFICATION_KIND, NOTIFICATION_AUDIENCE } = await import("@server/notifications/notification.types");
    const before = await notificationsService.badgeCount(second, orgId);
    const eventKey = key("a1");

    await emit({ kind: NOTIFICATION_KIND.CONNECTION_NEEDS_YOU, orgId, audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, facts: { connectionId: "c1" }, eventKey });

    expect(await notificationsService.badgeCount(owner, orgId)).toBeGreaterThanOrEqual(1);
    expect(await notificationsService.badgeCount(second, orgId)).toBe(before + 1);
    const rows = await prisma.delivery.findMany({ where: { eventKey }, select: { id: true, recipientId: true, channel: true, timing: true } });
    const { adminOrgService } = await import("@server/catalog/org.service");
    const members = await adminOrgService.listMemberIds(orgId);
    expect(members).toEqual(expect.arrayContaining([owner, second]));
    expect(rows.filter((r) => r.channel === "badge").map((r) => r.recipientId).sort()).toEqual([...members].sort());
    // The rest waits for the morning email: written, never enqueued.
    expect(rows.filter((r) => r.channel === "email").every((r) => r.timing === "DIGEST")).toBe(true);
    for (const r of rows) expect(await jobsFor(r.id)).toBe(0);
  });

  it("A3: the same event sent twice raises the badge once and writes no second delivery", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { NOTIFICATION_KIND, NOTIFICATION_AUDIENCE } = await import("@server/notifications/notification.types");
    const before = await notificationsService.badgeCount(second, orgId);
    const event = { kind: NOTIFICATION_KIND.POST_FAILED, orgId, audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, facts: { postId: "p1" }, eventKey: key("a3") };

    const written = await emit(event);
    expect(written).toBeGreaterThan(0);
    // Someone joining in between is not told about an event that already happened.
    const late = (await prisma.user.create({ data: { email: `hub-late-${RUN}@example.invalid` }, select: { id: true } })).id;
    await ensureOrgMember(orgId, late);
    expect(await emit(event)).toBe(0);
    expect(await notificationsService.badgeCount(late, orgId)).toBe(0);

    expect(await notificationsService.badgeCount(second, orgId)).toBe(before + 1);
    expect(await prisma.delivery.count({ where: { eventKey: event.eventKey } })).toBe(written);
  });

  it("A4: a Status due emails each member at once, once, keyed on the delivery", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { emailService } = await import("@server/notifications/email.service");
    const { NOTIFICATION_KIND, NOTIFICATION_AUDIENCE } = await import("@server/notifications/notification.types");
    const sent = vi.spyOn(emailService, "sendDelivery").mockResolvedValue("re_123");
    const eventKey = key("a4");

    await emit({ kind: NOTIFICATION_KIND.POST_DUE, orgId, audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, facts: { postId: "p2" }, eventKey });
    const mine = await prisma.delivery.findUniqueOrThrow({ where: { eventKey_recipientId_channel: { eventKey, recipientId: second, channel: "email" } } });
    expect(mine.timing).toBe("AT_ONCE");
    expect(await jobsFor(mine.id)).toBe(1);

    await notificationsService.deliver(mine.id);
    await notificationsService.deliver(mine.id);

    expect(sent).toHaveBeenCalledTimes(1);
    const [mail] = sent.mock.calls[0];
    expect(mail.to).toBe(`hub-${RUN}@example.invalid`);
    expect(mail.subject).toBe("Your Status is ready to post");
    expect(mail.idempotencyKey).toBe(`delivery-${mine.id}`);
    expect(mail.html).toContain(`/org/${orgId}/posts/p2/status`);
    const after = await prisma.delivery.findUniqueOrThrow({ where: { id: mine.id } });
    expect(after.state).toBe("SENT");
    expect(after.providerId).toBe("re_123");
    sent.mockRestore();
  });

  it("D2, Q7: a failed send is recorded with its reason, no body, and a retry still sends", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { emailService } = await import("@server/notifications/email.service");
    const { NOTIFICATION_KIND, NOTIFICATION_AUDIENCE } = await import("@server/notifications/notification.types");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sent = vi.spyOn(emailService, "sendDelivery").mockRejectedValueOnce(new Error("Failed to send email: rate limited")).mockResolvedValue("re_456");
    const eventKey = key("fail");

    await emit({ kind: NOTIFICATION_KIND.POST_DUE, orgId, audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, facts: { postId: "p3" }, eventKey });
    const mine = await prisma.delivery.findUniqueOrThrow({ where: { eventKey_recipientId_channel: { eventKey, recipientId: second, channel: "email" } } });

    await expect(notificationsService.deliver(mine.id)).rejects.toThrow("rate limited");
    const failed = await prisma.delivery.findUniqueOrThrow({ where: { id: mine.id } });
    expect([failed.state, failed.reason]).toEqual(["FAILED", "Failed to send email: rate limited"]);

    await notificationsService.deliver(mine.id);
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: mine.id } })).state).toBe("SENT");
    expect(sent).toHaveBeenCalledTimes(2);
    sent.mockRestore();
  });

  it("D3: a badge item whose subject was fixed leaves the list on the next open, and the count falls", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { NOTIFICATION_KIND, NOTIFICATION_AUDIENCE } = await import("@server/notifications/notification.types");
    const fixed = `fixed-${RUN}`;
    const asked = vi.fn(async (facts: Record<string, string>[]) => facts.map((f) => f.postId !== fixed));
    notificationsService.registerStillOpen(NOTIFICATION_KIND.POST_HELD, asked);
    const open = key("held-open");
    const gone = key("held-fixed");
    await emit({ kind: NOTIFICATION_KIND.POST_HELD, orgId, audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, facts: { postId: `open-${RUN}` }, eventKey: open });
    await emit({ kind: NOTIFICATION_KIND.POST_HELD, orgId, audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, facts: { postId: fixed }, eventKey: gone });
    const before = await notificationsService.badgeCount(second, orgId);

    const items = await notificationsService.needsYou(second, orgId);

    expect(items.map((i) => i.eventKey)).toContain(open);
    expect(items.map((i) => i.eventKey)).not.toContain(gone);
    expect(asked).toHaveBeenCalledTimes(1);
    expect(await notificationsService.badgeCount(second, orgId)).toBe(before - 1);
    const row = await prisma.delivery.findUniqueOrThrow({ where: { eventKey_recipientId_channel: { eventKey: gone, recipientId: second, channel: "badge" } } });
    expect(row.state).toBe("SUPERSEDED");
  });

  it("D3: an owner that cannot answer keeps its items, and the rest of the list still opens", async () => {
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { NOTIFICATION_KIND, NOTIFICATION_AUDIENCE } = await import("@server/notifications/notification.types");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    notificationsService.registerStillOpen(NOTIFICATION_KIND.CONVERSATION_WAITING, async () => {
      throw new Error("inbox down");
    });
    const waiting = key("waiting");
    await emit({ kind: NOTIFICATION_KIND.CONVERSATION_WAITING, orgId, audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, facts: { conversationId: "c9" }, eventKey: waiting });
    expect((await notificationsService.needsYou(second, orgId)).map((i) => i.eventKey)).toContain(waiting);
  });

  it("D3: another shop's events never reach this shop's badge", async () => {
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { NOTIFICATION_KIND, NOTIFICATION_AUDIENCE } = await import("@server/notifications/notification.types");
    const { otherOrgId } = await ensureFixtures();
    await ensureOrgMember(otherOrgId, second);
    const before = await notificationsService.badgeCount(second, orgId);
    const other = key("other");
    await emit({ kind: NOTIFICATION_KIND.POST_FAILED, orgId: otherOrgId, audience: NOTIFICATION_AUDIENCE.SHOP_MEMBERS, facts: { postId: "x" }, eventKey: other });
    expect(await notificationsService.badgeCount(second, otherOrgId)).toBeGreaterThanOrEqual(1);
    expect(await notificationsService.badgeCount(second, orgId)).toBe(before);
    expect((await notificationsService.needsYou(second, orgId)).map((i) => i.eventKey)).not.toContain(other);
  });
});
