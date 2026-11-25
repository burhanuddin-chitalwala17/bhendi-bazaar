/**
 * The morning email, the bell's sheet and retention against a real database (notification-hub/
 * notifications-core unit 3, D3, D4, D7): what waits is emailed once at 9 am, grouped by kind; nothing
 * waiting is no email; a member who turned it off gets none; events past 13 months are deleted.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureOrgMember, isDisposableDb } from "../helpers/test-db";

const RUN = Date.now();
/** The next morning's run: its 9 am is after every row these tests write. */
const due = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

describe.skipIf(!isDisposableDb)("morning email and bell (local db)", () => {
  let orgId = "";
  let ana = "";
  let bilal = "";
  const anaEmail = `digest-ana-${RUN}@example.invalid`;
  const bilalEmail = `digest-bilal-${RUN}@example.invalid`;
  const keys: string[] = [];
  const key = (name: string) => {
    const k = `test:digest:${name}:${RUN}`;
    keys.push(k);
    return k;
  };

  beforeAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    orgId = (
      await prisma.org.create({
        data: { code: `DIG-${RUN}`, handle: `dig${RUN}`, name: "Niqab <Boutique>", email: `dig-${RUN}@example.invalid` },
        select: { id: true },
      })
    ).id;
    ana = (await prisma.user.create({ data: { email: anaEmail }, select: { id: true } })).id;
    bilal = (await prisma.user.create({ data: { email: bilalEmail }, select: { id: true } })).id;
    await ensureOrgMember(orgId, ana);
    await ensureOrgMember(orgId, bilal);
  });

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { JOBS_SCHEMA, JOBS_QUEUE } = await import("@server/shared/jobs/jobs.config");
    await prisma.$executeRawUnsafe(`DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'notify.digest'`, JOBS_QUEUE);
    await prisma.notificationEvent.deleteMany({ where: { orgId } });
    await prisma.memberNotificationPrefs.deleteMany({ where: { orgId } });
    await prisma.orgMember.deleteMany({ where: { orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [ana, bilal] } } });
    await prisma.org.delete({ where: { id: orgId } });
  });

  const emit = async (kind: string, facts: Record<string, string>, eventKey: string) => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    return prisma.$transaction((tx) =>
      notificationsService.emit(tx, { kind: kind as never, orgId, audience: "SHOP_MEMBERS", facts, eventKey }),
    );
  };

  const mailsTo = (spy: { mock: { calls: [{ to: string | string[]; subject: string; html: string; idempotencyKey: string }][] } }, to: string) =>
    spy.mock.calls.map(([mail]) => mail).filter((mail) => mail.to === to);

  it("D4: an event waiting for the morning queues that morning's run, once", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { JOBS_SCHEMA, JOBS_QUEUE } = await import("@server/shared/jobs/jobs.config");
    const { nextDigestRun } = await import("@server/notifications/digest.job");
    const { date } = nextDigestRun(new Date());
    const count = async () =>
      Number(
        (
          await prisma.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'notify.digest' AND data->'payload'->>'date' = $2 AND state = 'created'`,
            JOBS_QUEUE,
            date,
          )
        )[0].n,
      );
    await emit("post-failed", { postId: "q1" }, key("queue-1"));
    await emit("post-failed", { postId: "q2" }, key("queue-2"));
    expect(await count()).toBe(1);
  });

  it("A2: two waiting conversations and a failed post are one morning email; a second run sends nothing", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { emailService } = await import("@server/notifications/email.service");
    await prisma.delivery.updateMany({ where: { recipientId: { in: [ana, bilal] }, timing: "DIGEST" }, data: { state: "SKIPPED" } });
    await emit("conversation-waiting", { conversationId: "c1" }, key("c1"));
    await emit("conversation-waiting", { conversationId: "c2" }, key("c2"));
    await emit("post-failed", { postId: "p1" }, key("p1"));
    const sent = vi.spyOn(emailService, "sendDelivery").mockResolvedValue("re_digest");

    await notificationsService.sendDigest(due());
    const mails = mailsTo(sent, anaEmail);
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe("3 things are waiting at Niqab <Boutique>");
    expect(mails[0].html).toContain("2 messages waiting over 4 hours");
    expect(mails[0].html).toContain("1 post failed");
    expect(mails[0].html).toContain("Niqab &lt;Boutique&gt;");
    expect(mails[0].html).toContain(`/org/${orgId}/shop/details/notifications`);
    expect(mails[0].idempotencyKey).toBe(`digest-${orgId}-${ana}-${due()}`);
    const rows = await prisma.delivery.findMany({ where: { recipientId: ana, timing: "DIGEST", eventKey: { in: keys } }, select: { state: true } });
    expect(new Set(rows.map((r) => r.state))).toEqual(new Set(["SENT", "SKIPPED"]));

    sent.mockClear();
    await notificationsService.sendDigest(due());
    expect(mailsTo(sent, anaEmail)).toHaveLength(0);
    sent.mockRestore();
  });

  it("Q12: a retried run covers only what waited at its own 9 am, so the provider key still matches", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { emailService } = await import("@server/notifications/email.service");
    const eventKey = key("late");
    await emit("post-failed", { postId: "late" }, eventKey);
    const sent = vi.spyOn(emailService, "sendDelivery").mockResolvedValue("re_late");
    const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);

    await notificationsService.sendDigest(yesterday);

    expect(mailsTo(sent, anaEmail)).toHaveLength(0);
    const row = await prisma.delivery.findUniqueOrThrow({ where: { eventKey_recipientId_channel: { eventKey, recipientId: ana, channel: "email" } } });
    expect(row.state).toBe("PENDING");
    sent.mockRestore();
    await prisma.delivery.updateMany({ where: { eventKey }, data: { state: "SKIPPED" } });
  });

  it("A2: with nothing waiting, no email is sent", async () => {
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { emailService } = await import("@server/notifications/email.service");
    const sent = vi.spyOn(emailService, "sendDelivery").mockResolvedValue("re_none");
    await notificationsService.sendDigest(due());
    expect(mailsTo(sent, anaEmail)).toHaveLength(0);
    expect(mailsTo(sent, bilalEmail)).toHaveLength(0);
    sent.mockRestore();
  });

  it("R4: a member who turned the morning email off gets none, and keeps the badge", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { emailService } = await import("@server/notifications/email.service");
    await notificationsService.setMorningEmail(bilal, orgId, false);
    expect(await notificationsService.morningEmail(bilal, orgId)).toBe(false);
    expect(await notificationsService.morningEmail(ana, orgId)).toBe(true);
    const eventKey = key("off");
    await emit("post-failed", { postId: "p9" }, eventKey);
    const sent = vi.spyOn(emailService, "sendDelivery").mockResolvedValue("re_off");

    await notificationsService.sendDigest(due());

    expect(mailsTo(sent, bilalEmail)).toHaveLength(0);
    expect(mailsTo(sent, anaEmail)).toHaveLength(1);
    const mine = await prisma.delivery.findUniqueOrThrow({ where: { eventKey_recipientId_channel: { eventKey, recipientId: bilal, channel: "email" } } });
    expect([mine.state, mine.reason]).toEqual(["SKIPPED", "morning email off"]);
    const badge = await prisma.delivery.findUniqueOrThrow({ where: { eventKey_recipientId_channel: { eventKey, recipientId: bilal, channel: "badge" } } });
    expect(badge.state).toBe("PENDING");
    sent.mockRestore();
    await notificationsService.setMorningEmail(bilal, orgId, true);
  });

  it("D4: an item fixed before 9 am is left out of the email and leaves the badge too", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { emailService } = await import("@server/notifications/email.service");
    notificationsService.registerStillOpen("connection-needs-you", async (facts) => facts.map((f) => f.connectionId !== "fixed"));
    const gone = key("conn-fixed");
    await emit("connection-needs-you", { connectionId: "fixed", platform: "instagram" }, gone);
    const sent = vi.spyOn(emailService, "sendDelivery").mockResolvedValue("re_fixed");

    await notificationsService.sendDigest(due());

    expect(mailsTo(sent, anaEmail)).toHaveLength(0);
    const row = await prisma.delivery.findUniqueOrThrow({ where: { eventKey_recipientId_channel: { eventKey: gone, recipientId: ana, channel: "email" } } });
    expect(row.state).toBe("SUPERSEDED");
    sent.mockRestore();
    notificationsService.registerStillOpen("connection-needs-you", async (facts) => facts.map(() => true));
  });

  it("D4: a failed send leaves its items waiting and fails the run, so the job retries", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { emailService } = await import("@server/notifications/email.service");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const eventKey = key("fail");
    await emit("post-held", { postId: "h1" }, eventKey);
    const sent = vi.spyOn(emailService, "sendDelivery").mockRejectedValue(new Error("provider down"));

    await expect(notificationsService.sendDigest(due())).rejects.toThrow("morning emails failed");
    const row = await prisma.delivery.findUniqueOrThrow({ where: { eventKey_recipientId_channel: { eventKey, recipientId: ana, channel: "email" } } });
    expect(row.state).toBe("PENDING");
    sent.mockRestore();
    await prisma.delivery.updateMany({ where: { eventKey }, data: { state: "SKIPPED" } });
  });

  it("A1, ux Many items: the sheet shows each item, and a kind that piles up as one row with its count", async () => {
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const { GROUP_FROM } = await import("@server/notifications/notifications.service");
    await emit("connection-needs-you", { connectionId: "ig1", platform: "instagram" }, key("ig1"));
    for (let n = 0; n < GROUP_FROM; n += 1) await emit("conversation-waiting", { conversationId: `g${n}` }, key(`g${n}`));

    const view = await notificationsService.needsYouView(ana, orgId);

    const titles = view.rows.map((r) => r.title);
    expect(titles).toContain("Instagram needs reconnecting");
    const ig = view.rows.find((r) => r.title === "Instagram needs reconnecting");
    expect(ig?.href).toBe(`/org/${orgId}/channels`);
    const grouped = view.rows.find((r) => r.kind === "conversation-waiting");
    expect(grouped?.count).toBeGreaterThanOrEqual(GROUP_FROM);
    expect(grouped?.title).toBe(`Messages waiting · ${grouped?.count}`);
    expect(view.count).toBe(await notificationsService.badgeCount(ana, orgId));
  });

  it("D7, Q7: events and their deliveries older than 13 months are deleted; younger ones stay", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { notificationsService } = await import("@server/notifications/notifications.service");
    const old = key("old");
    const recent = key("recent");
    await emit("post-failed", { postId: "old" }, old);
    await emit("post-failed", { postId: "recent" }, recent);
    const now = new Date("2026-11-25T10:00:00Z");
    await prisma.notificationEvent.update({ where: { eventKey: old }, data: { createdAt: new Date("2025-10-24T10:00:00Z") } });
    await prisma.notificationEvent.update({ where: { eventKey: recent }, data: { createdAt: new Date("2025-10-26T10:00:00Z") } });

    expect(await notificationsService.retention(now, 0)).toBeGreaterThanOrEqual(1);

    expect(await prisma.notificationEvent.findUnique({ where: { eventKey: old } })).toBeNull();
    expect(await prisma.delivery.count({ where: { eventKey: old } })).toBe(0);
    expect(await prisma.notificationEvent.findUnique({ where: { eventKey: recent } })).not.toBeNull();
  });
});
