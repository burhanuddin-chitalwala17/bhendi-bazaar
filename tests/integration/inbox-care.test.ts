/**
 * Needs you, the waiting event, support shares and their log, and retention against a real database
 * (social-selling inbox-core unit 4: D5, D9, D10).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isDisposableDb } from "../helpers/test-db";
import type { FactOf } from "@server/shared/social-events/facts";

const RUN = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe.skipIf(!isDisposableDb)("inbox care (local db)", () => {
  const orgs: string[] = [];
  const tickets: string[] = [];
  let orgId = "";
  let wa = "";
  let otherOrg = "";
  let otherWa = "";
  let n = 0;

  async function newShop(tag: string) {
    const { prisma } = await import("@server/shared/prisma");
    const org = await prisma.org.create({
      data: { code: `INC-${tag}-${RUN}`, handle: `inc${tag}${RUN}`.toLowerCase(), name: "Care shop", email: `inc-${tag}-${RUN}@example.invalid` },
      select: { id: true },
    });
    orgs.push(org.id);
    const conn = await prisma.channelConnection.create({
      data: { orgId: org.id, channel: "whatsapp", state: "CONNECTED", accessToken: "sealed-placeholder", externalPhoneId: `PH-${tag}-${RUN}`, connectedAt: new Date() },
      select: { id: true },
    });
    return { orgId: org.id, wa: conn.id };
  }

  beforeAll(async () => {
    ({ orgId, wa } = await newShop("a"));
    ({ orgId: otherOrg, wa: otherWa } = await newShop("b"));
    await import("@server/inbox/inbox.jobs");
  });

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.sealAccess.deleteMany({ where: { orgId: { in: orgs } } });
    await prisma.notificationEvent.deleteMany({ where: { orgId: { in: orgs } } });
    await prisma.ticket.deleteMany({ where: { id: { in: tickets } } });
    await prisma.channelConnection.deleteMany({ where: { orgId: { in: orgs } } });
    await prisma.orgDataKey.deleteMany({ where: { orgId: { in: orgs } } });
    await prisma.org.deleteMany({ where: { id: { in: orgs } } });
  });

  /** A person writes to the shop at `occurredAt`, through the inbox's real sink. Answers the thread. */
  async function writes(connectionId: string, occurredAt: Date, text = "Is the blue kurta in size M?") {
    const { sinksFor } = await import("@server/shared/social-events/sinks");
    const { prisma } = await import("@server/shared/prisma");
    const personKey = `p-${RUN}-${++n}`;
    const fact: FactOf<"inbound-message"> = {
      kind: "inbound-message",
      key: `ev-${RUN}-${n}`,
      connectionId,
      platform: "whatsapp",
      occurredAt,
      personKey,
      personScopedId: null,
      personName: `Person ${n}`,
      personHandle: null,
      personPhone: null,
      messageId: `wamid-${RUN}-${n}`,
      messageKind: "text",
      text,
      attachments: [],
      replyTo: null,
      buttonPayload: null,
      storyRef: null,
      productRetailerId: null,
      referral: null,
      unsupportedLabel: null,
      coordinates: null,
    };
    const [sink] = sinksFor("inbound-message").filter((s) => s.name.startsWith("inbox."));
    await sink.handle([fact] as never);
    const found = await prisma.conversation.findFirst({ where: { connectionId, personKey } });
    expect(found).not.toBeNull();
    return found!;
  }

  async function openRequest(forOrg: string, status = "open") {
    const { prisma } = await import("@server/shared/prisma");
    const t = await prisma.ticket.create({
      data: { type: "issue", kind: "issue", key: `inc-${RUN}-${++n}`, status, subject: {}, needs: { create: { orgId: forOrg } } },
      select: { id: true },
    });
    tickets.push(t.id);
    return t.id;
  }

  async function waitingEvents(conversationId: string) {
    const { prisma } = await import("@server/shared/prisma");
    return await prisma.notificationEvent.findMany({ where: { kind: "conversation-waiting", facts: { path: ["conversationId"], equals: conversationId } } });
  }

  describe("waiting (D5, R10)", () => {
    it("A6: a conversation unanswered for four hours produces one waiting event, however often the sweep runs (spec A6)", async () => {
      const { inboxWaiting } = await import("@server/inbox/inbox-waiting.service");
      const now = new Date();
      const old = await writes(wa, new Date(now.getTime() - 5 * HOUR));
      const fresh = await writes(wa, new Date(now.getTime() - 1 * HOUR));
      await inboxWaiting.sweep(now);
      await inboxWaiting.sweep(new Date(now.getTime() + 1000));
      const events = await waitingEvents(old.id);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ orgId, audience: "SHOP_MEMBERS", facts: { conversationId: old.id, platform: "whatsapp" } });
      expect(await waitingEvents(fresh.id)).toHaveLength(0);
    });

    it("A6: once a member has opened it, the person's next message starts a new spell with its own event (spec A6)", async () => {
      const { inboxWaiting } = await import("@server/inbox/inbox-waiting.service");
      const { prisma } = await import("@server/shared/prisma");
      const now = new Date();
      const c = await writes(wa, new Date(now.getTime() - 10 * HOUR));
      await inboxWaiting.sweep(now);
      // Opened by a member (unit 2's read): unread clears.
      await prisma.conversation.update({ where: { id: c.id }, data: { unread: false } });
      await inboxWaiting.sweep(now);
      expect(await waitingEvents(c.id)).toHaveLength(1);

      const { sinksFor } = await import("@server/shared/social-events/sinks");
      const [sink] = sinksFor("inbound-message").filter((s) => s.name.startsWith("inbox."));
      await sink.handle([
        {
          kind: "inbound-message",
          key: `ev-again-${RUN}`,
          connectionId: wa,
          platform: "whatsapp",
          occurredAt: new Date(now.getTime() - 5 * HOUR),
          personKey: c.personKey,
          personScopedId: null,
          personName: c.personName,
          personHandle: null,
          personPhone: null,
          messageId: `wamid-again-${RUN}`,
          messageKind: "text",
          text: "Hello?",
          attachments: [],
          replyTo: null,
          buttonPayload: null,
          storyRef: null,
          productRetailerId: null,
          referral: null,
          unsupportedLabel: null,
          coordinates: null,
        },
      ] as never);
      await inboxWaiting.sweep(new Date(now.getTime() + 2000));
      expect(await waitingEvents(c.id)).toHaveLength(2);
    });

    it("R4a: marking Needs you puts the thread first, moves the feed, and a read thread that needs the shop still waits", async () => {
      const { inboxWaiting } = await import("@server/inbox/inbox-waiting.service");
      const { prisma } = await import("@server/shared/prisma");
      const now = new Date();
      const c = await writes(wa, new Date(now.getTime() - 6 * HOUR));
      await prisma.conversation.update({ where: { id: c.id }, data: { unread: false } });
      await inboxWaiting.markNeedsYou(c.id, "handover", now);
      const after = (await prisma.conversation.findUnique({ where: { id: c.id } }))!;
      expect(after).toMatchObject({ needsYou: true, needsYouReason: "handover", sortRank: 0 });
      expect(after.changeSeq > c.changeSeq).toBe(true);
      await inboxWaiting.sweep(now);
      expect(await waitingEvents(c.id)).toHaveLength(1);
      expect(await inboxWaiting.stillWaiting([{ conversationId: c.id }])).toEqual([true]);
      await prisma.conversation.update({ where: { id: c.id }, data: { needsYou: false } });
      expect(await inboxWaiting.stillWaiting([{ conversationId: c.id }, { conversationId: "gone" }])).toEqual([false, false]);
    });

    it("A6: a thread already told about, then read, that an automatic reply hands over starts a new spell (spec A6)", async () => {
      const { inboxWaiting } = await import("@server/inbox/inbox-waiting.service");
      const { prisma } = await import("@server/shared/prisma");
      const now = new Date();
      const c = await writes(wa, new Date(now.getTime() - 7 * HOUR));
      await inboxWaiting.sweep(now);
      await prisma.conversation.update({ where: { id: c.id }, data: { unread: false } });
      await inboxWaiting.markNeedsYou(c.id, "unanswerable", now);
      await inboxWaiting.sweep(new Date(now.getTime() + 3000));
      expect(await waitingEvents(c.id)).toHaveLength(2);
    });

    async function sweepQueuedFor(inboundAt: Date) {
      const { prisma } = await import("@server/shared/prisma");
      const slot = Math.floor((inboundAt.getTime() + 4 * HOUR) / (10 * 60 * 1000));
      const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT count(*) AS "n" FROM pgboss.job WHERE "singleton_key" = ${`later:inbox.waiting:${slot}`} AND "data"->>'type' = 'inbox.waiting'`;
      return Number(rows[0].n);
    }

    it("D5: marking Needs you wakes the sweep for when the thread will be waiting", async () => {
      const { inboxWaiting } = await import("@server/inbox/inbox-waiting.service");
      const { prisma } = await import("@server/shared/prisma");
      // An hour in a slot no arrival here woke: only markNeedsYou can have queued it.
      const at = new Date(Date.now() - 3 * HOUR - 17 * 60 * 1000);
      const c = await writes(wa, at);
      await prisma.$executeRaw`DELETE FROM pgboss.job WHERE "data"->>'type' = 'inbox.waiting'`;
      expect(await sweepQueuedFor(at)).toBe(0);
      await inboxWaiting.markNeedsYou(c.id, "handover");
      expect(await sweepQueuedFor(at)).toBe(1);
    });

    it("D5: a sweep sleeps until the next thread is due, and wakes then", async () => {
      const { inboxWaiting } = await import("@server/inbox/inbox-waiting.service");
      const { prisma } = await import("@server/shared/prisma");
      const now = new Date();
      await inboxWaiting.sweep(now);
      const [{ at }] = await prisma.$queryRaw<Array<{ at: Date | null }>>`
        SELECT MIN("lastInboundAt") AS "at" FROM "Conversation"
        WHERE "waitingEmittedAt" IS NULL AND ("needsYou" OR "unread") AND "lastInboundAt" IS NOT NULL`;
      expect(at).not.toBeNull();
      await prisma.$executeRaw`DELETE FROM pgboss.job WHERE "data"->>'type' = 'inbox.waiting'`;
      await inboxWaiting.sweep(new Date(now.getTime() + 1000));
      expect(await sweepQueuedFor(at!)).toBe(1);
    });

    it("Needs you on a thread that does not exist is not found", async () => {
      const { inboxWaiting } = await import("@server/inbox/inbox-waiting.service");
      await expect(inboxWaiting.markNeedsYou(`missing-${RUN}`, "unanswerable")).rejects.toMatchObject({ name: "NotFoundError" });
    });
  });

  describe("support shares and the open log (D9, R14)", () => {
    it("A7: a chat shared for one request opens for support for 48 hours only, and each open is in Who has opened your chats (spec A7)", async () => {
      const { inboxPrivacy } = await import("@server/inbox/inbox-privacy.service");
      const { prisma } = await import("@server/shared/prisma");
      const now = new Date();
      const c = await writes(wa, new Date(now.getTime() - HOUR), "My order number is 1234");
      // Nothing is shared yet: support finds nothing, and nothing is logged.
      await expect(inboxPrivacy.openForSupport("support-1", c.id, now)).rejects.toMatchObject({ name: "NotFoundError" });

      const requestId = await openRequest(orgId);
      const share = await inboxPrivacy.share(orgId, "member-1", c.id, requestId, now);
      expect(new Date(share.until).getTime() - now.getTime()).toBe(48 * HOUR);
      expect(await inboxPrivacy.shareOf(orgId, c.id, now)).toEqual(share);

      const opened = await inboxPrivacy.openForSupport("support-1", c.id, new Date(now.getTime() + HOUR));
      expect(opened.map((m) => m.body)).toEqual(["My order number is 1234"]);
      const log = await inboxPrivacy.forShop(orgId, new Date(now.getTime() + HOUR));
      expect(log.opens.filter((o) => o.conversationId === c.id)).toHaveLength(1);
      expect(log.opens[0]).toMatchObject({ conversationId: c.id, person: c.personName });
      expect(log.shares.map((s) => s.conversationId)).toContain(c.id);
      // The other shop's log shows nothing of it.
      expect((await inboxPrivacy.forShop(otherOrg)).opens).toEqual([]);

      await expect(inboxPrivacy.openForSupport("support-1", c.id, new Date(now.getTime() + 48 * HOUR + 1000))).rejects.toMatchObject({ name: "NotFoundError" });
      expect(await prisma.sealAccess.count({ where: { conversationId: c.id } })).toBe(1);
    });

    it("A7: Stop sharing ends it at once; another shop cannot stop or share it", async () => {
      const { inboxPrivacy } = await import("@server/inbox/inbox-privacy.service");
      const now = new Date();
      const c = await writes(wa, new Date(now.getTime() - HOUR));
      await inboxPrivacy.share(orgId, "member-1", c.id, await openRequest(orgId), now);
      await expect(inboxPrivacy.stopSharing(otherOrg, c.id, now)).rejects.toMatchObject({ name: "NotFoundError" });
      await expect(inboxPrivacy.share(otherOrg, "member-2", c.id, await openRequest(otherOrg), now)).rejects.toMatchObject({ name: "NotFoundError" });
      expect(await inboxPrivacy.shareOf(otherOrg, c.id, now)).toBeNull();
      await inboxPrivacy.stopSharing(orgId, c.id, now);
      await expect(inboxPrivacy.openForSupport("support-1", c.id, new Date(now.getTime() + 1000))).rejects.toMatchObject({ name: "NotFoundError" });
      expect(await inboxPrivacy.shareOf(orgId, c.id, now)).toBeNull();
    });

    it("A7: a chat is shared only for the shop's own open request", async () => {
      const { inboxPrivacy } = await import("@server/inbox/inbox-privacy.service");
      const c = await writes(wa, new Date(Date.now() - HOUR));
      await expect(inboxPrivacy.share(orgId, "member-1", c.id, await openRequest(otherOrg))).rejects.toMatchObject({ name: "DomainError", field: "requestId" });
      await expect(inboxPrivacy.share(orgId, "member-1", c.id, await openRequest(orgId, "done"))).rejects.toMatchObject({ name: "DomainError", field: "requestId" });
    });
  });

  describe("retention (D10, R13)", () => {
    it("R13: 90 days after a disconnect the account's chats are deleted; before that they are kept; the open log outlives them", async () => {
      const { inboxRetention } = await import("@server/inbox/inbox-retention.service");
      const { inboxPrivacy } = await import("@server/inbox/inbox-privacy.service");
      const { prisma } = await import("@server/shared/prisma");
      const now = new Date();
      const c = await writes(otherWa, new Date(now.getTime() - HOUR));
      const ticket = await openRequest(otherOrg);
      await inboxPrivacy.share(otherOrg, "member-2", c.id, ticket, now);
      await inboxPrivacy.openForSupport("support-1", c.id, now);
      await prisma.channelConnection.update({ where: { id: otherWa }, data: { state: "DISCONNECTED", accessToken: null, disconnectedAt: new Date(now.getTime() - 89 * DAY) } });
      await inboxRetention.run(now);
      expect(await prisma.conversation.count({ where: { id: c.id } })).toBe(1);

      await prisma.channelConnection.update({ where: { id: otherWa }, data: { disconnectedAt: new Date(now.getTime() - 91 * DAY) } });
      await inboxRetention.run(now);
      expect(await prisma.conversation.count({ where: { id: c.id } })).toBe(0);
      expect(await prisma.message.count({ where: { conversationId: c.id } })).toBe(0);
      expect(await prisma.supportGrant.count({ where: { conversationId: c.id } })).toBe(0);
      const log = await inboxPrivacy.forShop(otherOrg);
      expect(log.opens.find((o) => o.conversationId === c.id)).toMatchObject({ person: null });
    });

    it("R13: reconnected to another account 90 days ago, the past account's chats go and the present one's stay", async () => {
      const { inboxRetention } = await import("@server/inbox/inbox-retention.service");
      const { prisma } = await import("@server/shared/prisma");
      const now = new Date();
      const { wa: conn } = await newShop("c");
      const past = await writes(conn, new Date(now.getTime() - 2 * HOUR));
      expect(past.accountRef).toBe(`PH-c-${RUN}`);
      await prisma.channelConnection.update({ where: { id: conn }, data: { externalPhoneId: `PH-c2-${RUN}`, connectedAt: new Date(now.getTime() - 91 * DAY) } });
      const present = await writes(conn, new Date(now.getTime() - HOUR));
      const unknown = await writes(conn, new Date(now.getTime() - HOUR));
      await prisma.conversation.update({ where: { id: unknown.id }, data: { accountRef: null } });
      await inboxRetention.run(now);
      expect(await prisma.conversation.count({ where: { id: past.id } })).toBe(0);
      expect(await prisma.conversation.count({ where: { id: { in: [present.id, unknown.id] } } })).toBe(2);
    });

    it("R13: a person's deletion request removes their chats in every shop at once", async () => {
      const { allForgetters } = await import("@server/shared/social-events/forget");
      const { prisma } = await import("@server/shared/prisma");
      const mine = await writes(wa, new Date(Date.now() - HOUR));
      const keep = await writes(wa, new Date(Date.now() - HOUR));
      const inbox = allForgetters().find((f) => f.name === "inbox");
      expect(inbox).toBeDefined();
      await inbox!.forget("whatsapp", mine.personKey);
      expect(await prisma.conversation.count({ where: { id: mine.id } })).toBe(0);
      expect(await prisma.conversation.count({ where: { id: keep.id } })).toBe(1);
    });
  });
});
