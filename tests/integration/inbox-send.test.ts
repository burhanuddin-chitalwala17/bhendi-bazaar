/**
 * Sending from the inbox against a real database (social-selling inbox-core unit 3): a member's reply
 * is held 7 s with Undo, sent through the ConversationSource port by its job, retried once on a "not
 * sent", and left uncertain rather than sent twice. The platform is a fake source; nothing leaves.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isDisposableDb } from "../helpers/test-db";
import type { ConversationSource, OutgoingMessage, ReplyWindowState } from "@server/channels/conversation-source.types";
import type { SocialError } from "@server/channels/social/types";

const RUN = Date.now();
/** For tests that wait out a hold or a retry's pause in real time. */
const SLOW = 30_000;

type Behaviour = "ok" | SocialError;

describe.skipIf(!isDisposableDb)("inbox send (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let send: typeof import("@server/inbox/inbox-send.service").inboxSendService;
  const orgs: string[] = [];
  const users: string[] = [];
  let orgId = "";
  let memberId = "";
  let wa = "";
  let otherOrgId = "";
  let otherWa = "";

  /** The fake platform: records every send, answers from a script, reports the window it is told. */
  const calls: OutgoingMessage[] = [];
  let script: Behaviour[] = [];
  let window: ReplyWindowState = "open";
  const fake: ConversationSource = {
    platform: "whatsapp",
    window: () => ({ state: window, closesAt: null }),
    async send(message) {
      calls.push(message);
      const next = script.shift() ?? "ok";
      if (next === "ok") return { platformMessageId: `wamid.out-${randomUUID()}` };
      const { MetaError } = await import("@server/channels/providers/meta/errors");
      throw new MetaError(next, "test.send");
    },
    markRead: async () => undefined,
    typing: async () => undefined,
    fetchMedia: async () => ({ bytes: Buffer.alloc(0), mimeType: null }),
    actions: () => [],
  };

  async function newShop(tag: string) {
    const org = await prisma.org.create({
      data: { code: `SND-${tag}-${RUN}`, handle: `snd${tag}${RUN}`.toLowerCase(), name: "Send shop", email: `snd-${tag}-${RUN}@example.invalid` },
      select: { id: true },
    });
    orgs.push(org.id);
    const connection = await prisma.channelConnection.create({
      data: { orgId: org.id, channel: "whatsapp", state: "CONNECTED", accessToken: "sealed-placeholder", externalAccountId: `WA-S-${tag}-${RUN}` },
      select: { id: true },
    });
    return { orgId: org.id, wa: connection.id };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ inboxSendService: send } = await import("@server/inbox/inbox-send.service"));
    const { registerConversationSource, resetConversationSources } = await import("@server/channels/conversation-source.service");
    resetConversationSources();
    registerConversationSource(fake);
    ({ orgId, wa } = await newShop("a"));
    ({ orgId: otherOrgId, wa: otherWa } = await newShop("b"));
    const user = await prisma.user.create({ data: { email: `snd-member-${RUN}@example.invalid`, name: "Farida" }, select: { id: true } });
    users.push(user.id);
    memberId = user.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`DELETE FROM pgboss.job WHERE data->'payload'->>'orgId' = ANY($1::text[])`, orgs);
    await prisma.channelConnection.deleteMany({ where: { orgId: { in: orgs } } });
    await prisma.orgDataKey.deleteMany({ where: { orgId: { in: orgs } } });
    await prisma.org.deleteMany({ where: { id: { in: orgs } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    const { resetConversationSources } = await import("@server/channels/conversation-source.service");
    resetConversationSources();
  });

  beforeEach(() => {
    calls.length = 0;
    script = [];
    window = "open";
  });

  /** A buyer writes in, so the shop has a thread to answer. */
  async function thread(connectionId = wa): Promise<string> {
    const { inboxIntake } = await import("@server/inbox/inbox-intake.service");
    const personKey = `p-${randomUUID()}`;
    await inboxIntake.messages(
      [
        {
          kind: "inbound-message",
          key: `ev-${randomUUID()}`,
          connectionId,
          platform: "whatsapp",
          occurredAt: new Date(),
          personKey,
          personScopedId: null,
          personName: "Ayesha",
          personHandle: null,
          personPhone: "+919800000001",
          messageId: `wamid-${randomUUID()}`,
          messageKind: "text",
          text: "Is the blue kurta in size M?",
          attachments: [],
          replyTo: null,
          buttonPayload: null,
          storyRef: null,
          productRetailerId: null,
          referral: null,
          unsupportedLabel: null,
          coordinates: null,
        },
      ],
      true,
    );
    const c = await prisma.conversation.findFirst({ where: { connectionId, personKey }, select: { id: true } });
    expect(c).not.toBeNull();
    return c!.id;
  }

  const reply = (text: string, clientId = randomUUID()) => ({ clientId, text });
  const row = async (id: string) => {
    const found = await prisma.message.findUnique({ where: { id } });
    expect(found).not.toBeNull();
    return found!;
  };
  const conversationRow = async (id: string) => {
    const found = await prisma.conversation.findUnique({ where: { id } });
    expect(found).not.toBeNull();
    return found!;
  };
  /** Test seam: the hold has run out, as if seven seconds had passed. */
  const holdOver = (id: string) => prisma.message.update({ where: { id }, data: { sendAfter: new Date(Date.now() - 1000) } });
  const jobsFor = (id: string) =>
    // Epoch millis: a raw timestamptz read through the adapter loses its offset.
    prisma.$queryRawUnsafe<Array<{ startsAt: number }>>(
      `SELECT (extract(epoch FROM start_after) * 1000)::float8 AS "startsAt" FROM pgboss.job WHERE data->>'type' = 'inbox.send' AND data->'payload'->>'messageId' = $1 ORDER BY created_on`,
      id,
    );

  it("A8: Send then Undo within 7 seconds puts the text back and nothing reaches the buyer", async () => {
    const conversationId = await thread();
    const held = await send.send(orgId, memberId, conversationId, reply("Yes, size M is in stock"));
    expect(held.state).toBe("HELD");
    const due = new Date(held.sendAfter!).getTime() - Date.now();
    expect(due).toBeGreaterThan(5_000);
    expect(due).toBeLessThanOrEqual(7_000);

    expect(await send.undo(orgId, held.id)).toEqual({ text: "Yes, size M is in stock", mediaId: null });
    expect((await row(held.id)).state).toBe("CANCELLED");
    await holdOver(held.id);
    await send.deliver(orgId, held.id);
    expect(calls).toHaveLength(0);
    expect((await row(held.id)).state).toBe("CANCELLED");
  });

  it("A8: without Undo the job sends it at the hold's end, with no client involved", async () => {
    const conversationId = await thread();
    const held = await send.send(orgId, memberId, conversationId, reply("Sending the photo now"));
    // The job is written with the row, due at once (a delayed job waits for the queue's slow poll), and
    // waits out the hold itself: a closed tab changes nothing.
    const jobs = await jobsFor(held.id);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].startsAt).toBeLessThanOrEqual(Date.now() + 1000);

    const started = Date.now();
    await send.deliver(orgId, held.id);
    expect(Date.now() - started).toBeGreaterThan(5_000);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ messageId: held.id, text: "Sending the photo now", window: "open", conversation: { connectionId: wa, kind: "DM" } });
    const sent = await row(held.id);
    expect(sent).toMatchObject({ state: "SENT", author: "MEMBER", memberId, direction: "OUT", sendAttempts: 1 });
    expect(sent.platformMessageId).toMatch(/^wamid\.out-/);
    expect(sent.bodySealed).not.toContain("photo");
    await expect(send.undo(orgId, held.id)).rejects.toMatchObject({ status: 409 });

    // A job delivered twice sends once.
    await send.deliver(orgId, held.id);
    expect(calls).toHaveLength(1);
  }, SLOW);

  it("A8: Undo while the job is waiting out the hold: nothing reaches the buyer", async () => {
    const conversationId = await thread();
    const held = await send.send(orgId, memberId, conversationId, reply("changed my mind"));
    const job = send.deliver(orgId, held.id);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expect((await send.undo(orgId, held.id)).text).toBe("changed my mind");
    await job;
    expect(calls).toHaveLength(0);
    expect((await row(held.id)).state).toBe("CANCELLED");
  }, SLOW);

  it("D6: a wait longer than the job holds goes back to the queue, due when the row is", async () => {
    const conversationId = await thread();
    const held = await send.send(orgId, memberId, conversationId, reply("later"));
    const due = new Date(Date.now() + 120_000);
    await prisma.message.update({ where: { id: held.id }, data: { sendAfter: due } });
    await send.deliver(orgId, held.id);
    expect(calls).toHaveLength(0);
    expect((await row(held.id)).state).toBe("HELD");
    const jobs = await jobsFor(held.id);
    expect(jobs).toHaveLength(2);
    expect(Math.abs(jobs[1].startsAt - due.getTime())).toBeLessThan(1000);
  });

  it("A2/D6: a reply clears Needs you, pauses automatic replies and becomes the thread's preview once sent", async () => {
    const conversationId = await thread();
    await prisma.conversation.update({ where: { id: conversationId }, data: { needsYou: true, needsYouReason: "handover", sortRank: 0 } });
    const held = await send.send(orgId, memberId, conversationId, reply("Happy to help"));
    let c = await conversationRow(conversationId);
    expect(c).toMatchObject({ needsYou: false, needsYouReason: null, sortRank: 1, unread: true });
    expect(c.botPausedUntil!.getTime()).toBeGreaterThan(Date.now() + 11 * 3600_000);

    await holdOver(held.id);
    await send.deliver(orgId, held.id);
    c = await conversationRow(conversationId);
    expect(c).toMatchObject({ unread: false, lastMessageKind: "TEXT" });
    const { seal } = await import("@server/shared/seal/seal");
    expect(await seal.open({ orgId, table: "Conversation", rowId: conversationId }, c.lastPreviewSealed!)).toBe("Happy to help");
  });

  it("hazard: Undo racing the send at the hold's edge, exactly one wins", async () => {
    for (let i = 0; i < 5; i++) {
      calls.length = 0;
      const conversationId = await thread();
      const held = await send.send(orgId, memberId, conversationId, reply(`race ${i}`));
      await holdOver(held.id);
      const [, undone] = await Promise.allSettled([send.deliver(orgId, held.id), send.undo(orgId, held.id)]);
      const state = (await row(held.id)).state;
      if (undone.status === "fulfilled") {
        expect(state).toBe("CANCELLED");
        expect(calls).toHaveLength(0);
      } else {
        expect(state).toBe("SENT");
        expect(calls).toHaveLength(1);
      }
    }
  });

  it("A5: a temporary failure is retried once, then shows Not sent with its reason, and Try again sends it", async () => {
    const conversationId = await thread();
    const held = await send.send(orgId, memberId, conversationId, reply("Price is ₹1,200"));
    await holdOver(held.id);
    script = ["unavailable", "unavailable"];

    await send.deliver(orgId, held.id);
    expect(await row(held.id)).toMatchObject({ state: "QUEUED", sendAttempts: 1, errorCode: "unavailable" });
    expect(await jobsFor(held.id)).toHaveLength(2);

    await send.deliver(orgId, held.id);
    expect(await row(held.id)).toMatchObject({ state: "FAILED", sendAttempts: 2, errorCode: "unavailable" });
    expect(calls).toHaveLength(2);

    expect(await send.retry(orgId, held.id)).toMatchObject({ id: held.id, state: "QUEUED" });
    await expect(send.retry(orgId, held.id)).rejects.toMatchObject({ status: 409 });
    await send.deliver(orgId, held.id);
    expect(await row(held.id)).toMatchObject({ state: "SENT", errorCode: null });
    expect(calls).toHaveLength(3);
  }, SLOW);

  it("Q9: a failure that will not change is not retried", async () => {
    const conversationId = await thread();
    const held = await send.send(orgId, memberId, conversationId, reply("Hello"));
    await holdOver(held.id);
    script = ["undeliverable"];
    await send.deliver(orgId, held.id);
    expect(await row(held.id)).toMatchObject({ state: "FAILED", errorCode: "undeliverable", sendAttempts: 1 });
    expect(calls).toHaveLength(1);
  });

  it("ADR-0086: a send that may have gone is UNCERTAIN, never retried, and WhatsApp's status settles it", async () => {
    const conversationId = await thread();
    const held = await send.send(orgId, memberId, conversationId, reply("Did this go?"));
    await holdOver(held.id);
    script = ["uncertain"];
    await send.deliver(orgId, held.id);
    expect((await row(held.id)).state).toBe("UNCERTAIN");
    await send.deliver(orgId, held.id);
    expect(calls).toHaveLength(1);

    const { inboxIntake } = await import("@server/inbox/inbox-intake.service");
    await inboxIntake.statuses([
      {
        kind: "message-status",
        key: `st-${randomUUID()}`,
        connectionId: wa,
        platform: "whatsapp",
        occurredAt: new Date(),
        messageId: "wamid.settled",
        status: "sent",
        recipientKey: null,
        callbackRef: held.id,
        errorCode: null,
        pricingCategory: null,
        billable: null,
        windowClosesAt: null,
      } as never,
    ]);
    expect(await row(held.id)).toMatchObject({ state: "SENT", platformMessageId: "wamid.settled" });
  });

  it("ADR-0086: a try that died after its claim is UNCERTAIN on the next run, not sent again", async () => {
    const conversationId = await thread();
    const held = await send.send(orgId, memberId, conversationId, reply("crash"));
    await prisma.message.update({ where: { id: held.id }, data: { state: "CLAIMED" } });
    await send.deliver(orgId, held.id);
    expect((await row(held.id)).state).toBe("UNCERTAIN");
    expect(calls).toHaveLength(0);
  });

  it("A-D9: a send that finds the account's lane busy waits its turn without spending its retry", async () => {
    const conversationId = await thread();
    const held = await send.send(orgId, memberId, conversationId, reply("queued behind another"));
    await holdOver(held.id);
    const { connectionLaneRepository, LANE } = await import("@server/channels/connection-lane.repository");
    expect(await connectionLaneRepository.claim(wa, LANE.MESSAGES, "someone-else", 60)).toBe(true);
    try {
      await send.deliver(orgId, held.id);
    } finally {
      await connectionLaneRepository.expire(wa, LANE.MESSAGES);
    }
    expect(await row(held.id)).toMatchObject({ state: "QUEUED", sendAttempts: 0 });
    expect(calls).toHaveLength(0);
    expect(await jobsFor(held.id)).toHaveLength(2);
    await send.deliver(orgId, held.id);
    expect((await row(held.id)).state).toBe("SENT");
  }, SLOW);

  it("D3: the window is checked at Send and again at the send", async () => {
    const conversationId = await thread();
    window = "template_only";
    await expect(send.send(orgId, memberId, conversationId, reply("too late"))).rejects.toMatchObject({ status: 409 });

    window = "open";
    const held = await send.send(orgId, memberId, conversationId, reply("just in time"));
    await holdOver(held.id);
    window = "shut";
    await send.deliver(orgId, held.id);
    expect(await row(held.id)).toMatchObject({ state: "FAILED", errorCode: "window_closed" });
    expect(calls).toHaveLength(0);
  });

  it("R5: a double tap with the same client id is one reply", async () => {
    const conversationId = await thread();
    const clientId = randomUUID();
    const [a, b] = await Promise.all([
      send.send(orgId, memberId, conversationId, reply("once", clientId)),
      send.send(orgId, memberId, conversationId, reply("once", clientId)),
    ]);
    expect(a.id).toBe(b.id);
    expect(await prisma.message.count({ where: { conversationId, direction: "OUT" } })).toBe(1);
    expect(await jobsFor(a.id)).toHaveLength(1);
  });

  it("R12: a shop cannot send into, undo or retry another shop's thread", async () => {
    const theirs = await thread(otherWa);
    await expect(send.send(orgId, memberId, theirs, reply("not mine"))).rejects.toMatchObject({ status: 404 });
    const held = await send.send(otherOrgId, memberId, theirs, reply("theirs"));
    await expect(send.undo(orgId, held.id)).rejects.toMatchObject({ status: 404 });
    await expect(send.retry(orgId, held.id)).rejects.toMatchObject({ status: 404 });
    await send.deliver(orgId, held.id);
    expect((await row(held.id)).state).toBe("HELD");
  });

  it("Q5: a picture must be a ready one from the shop's own library", async () => {
    const conversationId = await thread();
    await expect(send.send(orgId, memberId, conversationId, { clientId: randomUUID(), text: "", mediaId: "not-an-asset" })).rejects.toMatchObject({
      status: 400,
      field: "mediaId",
    });
  });

  it("sendAutomatic: an automatic reply goes at once, without a hold, leaving Needs you as it was", async () => {
    const conversationId = await thread();
    await prisma.conversation.update({ where: { id: conversationId }, data: { needsYou: true, sortRank: 0 } });
    const queued = await send.sendAutomatic({ orgId, conversationId, key: `auto-${RUN}-1`, text: "We open at 11" });
    expect(queued).toMatchObject({ state: "QUEUED", sendAfter: null });
    const again = await send.sendAutomatic({ orgId, conversationId, key: `auto-${RUN}-1`, text: "We open at 11" });
    expect(again.id).toBe(queued.id);
    await send.deliver(orgId, queued.id);
    expect(await row(queued.id)).toMatchObject({ state: "SENT", author: "AUTOMATIC", memberId: null });
    expect(await conversationRow(conversationId)).toMatchObject({ needsYou: true, botPausedUntil: null });
  });
});
