/**
 * The inbox's sinks against a real database (social-selling inbox-core unit 1): facts land as
 * conversations and messages, once each, in platform order, sealed under the shop's key.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isDisposableDb } from "../helpers/test-db";
import type { FactKind, FactOf, SocialFact } from "@server/shared/social-events/facts";

const RUN = Date.now();
const at = (minute: number) => new Date(Date.UTC(2026, 10, 25, 10, minute));

describe.skipIf(!isDisposableDb)("inbox intake (local db)", () => {
  const orgs: string[] = [];
  let orgId = "";
  let ig = "";
  let wa = "";
  let otherWa = "";

  async function newShop(tag: string) {
    const { prisma } = await import("@server/shared/prisma");
    const org = await prisma.org.create({
      data: { code: `INB-${tag}-${RUN}`, handle: `inb${tag}${RUN}`.toLowerCase(), name: "Inbox shop", email: `inb-${tag}-${RUN}@example.invalid` },
      select: { id: true },
    });
    orgs.push(org.id);
    const connect = async (channel: string, externalAccountId: string) =>
      (
        await prisma.channelConnection.create({
          data: { orgId: org.id, channel, state: "CONNECTED", accessToken: "sealed-placeholder", externalAccountId },
          select: { id: true },
        })
      ).id;
    return { orgId: org.id, ig: await connect("instagram", `IG-${tag}-${RUN}`), wa: await connect("whatsapp", `WA-${tag}-${RUN}`) };
  }

  beforeAll(async () => {
    ({ orgId, ig, wa } = await newShop("a"));
    ({ wa: otherWa } = await newShop("b"));
    await import("@server/inbox/inbox.sinks");
  });

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { orgId: { in: orgs } } });
    await prisma.orgDataKey.deleteMany({ where: { orgId: { in: orgs } } });
    await prisma.org.deleteMany({ where: { id: { in: orgs } } });
  });

  async function hand<K extends FactKind>(kind: K, facts: Array<FactOf<K>>) {
    const { sinksFor } = await import("@server/shared/social-events/sinks");
    const sinks = sinksFor(kind).filter((sink) => sink.name.startsWith("inbox."));
    expect(sinks).toHaveLength(1);
    await sinks[0].handle(facts as never);
  }

  const inbound = (over: Partial<FactOf<"inbound-message">> = {}): FactOf<"inbound-message"> => ({
    kind: "inbound-message",
    key: `ev-${Math.random()}`,
    connectionId: wa,
    platform: "whatsapp",
    occurredAt: at(0),
    personKey: `person-${RUN}`,
    personScopedId: null,
    personName: "Ayesha",
    personHandle: null,
    personPhone: "+919800000001",
    messageId: `wamid-${Math.random()}`,
    messageKind: "text",
    text: "Is the blue kurta in size M?",
    attachments: [],
    replyTo: null,
    buttonPayload: null,
    storyRef: null,
    productRetailerId: null,
    referral: null,
    unsupportedLabel: null,
    ...over,
  });

  async function conversationOf(connectionId: string, personKey: string) {
    const { prisma } = await import("@server/shared/prisma");
    const found = await prisma.conversation.findFirst({
      where: { connectionId, personKey },
      include: { messages: { orderBy: [{ sentAt: "asc" }, { id: "asc" }] } },
    });
    expect(found).not.toBeNull();
    return found!;
  }

  it("A1: a message arrives as an unread conversation in its platform's tab", async () => {
    const fact = inbound({ personKey: `p-a1-${RUN}` });
    await hand("inbound-message", [fact]);
    const c = await conversationOf(wa, fact.personKey);
    expect(c).toMatchObject({ orgId, platform: "whatsapp", kind: "DM", unread: true, personName: "Ayesha", personPhone: "+919800000001" });
    expect(c.lastInboundAt).toEqual(fact.occurredAt);
    expect(c.messages).toHaveLength(1);
    expect(c.messages[0]).toMatchObject({ direction: "IN", author: "PERSON", kind: "TEXT", platformMessageId: fact.messageId, state: null });
  });

  it("R12: the same message handed twice is stored once, and the second hand-over moves nothing", async () => {
    const fact = inbound({ personKey: `p-r12-${RUN}` });
    await hand("inbound-message", [fact]);
    const before = await conversationOf(wa, fact.personKey);
    await hand("inbound-message", [fact]);
    const after = await conversationOf(wa, fact.personKey);
    expect(after.messages).toHaveLength(1);
    expect(after.changeSeq).toBe(before.changeSeq);
  });

  it("R12: each shop sees only its own: one person writing two shops is two conversations", async () => {
    const personKey = `p-two-${RUN}`;
    await hand("inbound-message", [inbound({ personKey, connectionId: wa }), inbound({ personKey, connectionId: otherWa })]);
    const mine = await conversationOf(wa, personKey);
    const theirs = await conversationOf(otherWa, personKey);
    expect(mine.id).not.toBe(theirs.id);
    expect(mine.orgId).toBe(orgId);
    expect(theirs.orgId).not.toBe(orgId);
  });

  it("A7: the body and the preview are ciphertext at rest, and open only at their own row", async () => {
    const fact = inbound({ personKey: `p-a7-${RUN}`, text: "My address is 12 Bhendi Bazaar" });
    await hand("inbound-message", [fact]);
    const c = await conversationOf(wa, fact.personKey);
    const message = c.messages[0];
    expect(message.bodySealed).toMatch(/^s1\./);
    expect(message.bodySealed).not.toContain("Bhendi");
    expect(c.lastPreviewSealed).toMatch(/^s1\./);
    const { seal, SealError } = await import("@server/shared/seal/seal");
    expect(await seal.open({ orgId, table: "Message", rowId: message.id }, message.bodySealed!)).toBe(fact.text);
    expect(await seal.open({ orgId, table: "Conversation", rowId: c.id }, c.lastPreviewSealed!)).toBe(fact.text);
    await expect(seal.open({ orgId, table: "Message", rowId: c.id }, message.bodySealed!)).rejects.toBeInstanceOf(SealError);
  });

  it("hazard: a late message sorts by platform time and leaves the newer preview in place", async () => {
    const personKey = `p-late-${RUN}`;
    await hand("inbound-message", [inbound({ personKey, occurredAt: at(10), text: "second" })]);
    await hand("inbound-message", [inbound({ personKey, occurredAt: at(5), text: "first" })]);
    const c = await conversationOf(wa, personKey);
    const { seal } = await import("@server/shared/seal/seal");
    const texts = await Promise.all(c.messages.map((m) => seal.open({ orgId, table: "Message", rowId: m.id }, m.bodySealed!)));
    expect(texts).toEqual(["first", "second"]);
    expect(c.lastMessageAt).toEqual(at(10));
    expect(await seal.open({ orgId, table: "Conversation", rowId: c.id }, c.lastPreviewSealed!)).toBe("second");
  });

  it("A4: a voice note is kept as audio with its file; a view-once photo lands as its named line", async () => {
    const personKey = `p-a4-${RUN}`;
    await hand("inbound-message", [
      inbound({ personKey, occurredAt: at(1), messageKind: "audio", text: null, attachments: [{ ref: "media-1", mimeType: "audio/ogg", caption: null, fileName: null }] }),
      inbound({ personKey, occurredAt: at(2), messageKind: "unsupported", text: null, unsupportedLabel: "A view-once message" }),
    ]);
    const c = await conversationOf(wa, personKey);
    expect(c.messages.map((m) => [m.kind, m.attachmentRef, m.label])).toEqual([
      ["AUDIO", "media-1", null],
      ["UNSUPPORTED", null, "A view-once message"],
    ]);
    expect(c.lastMessageKind).toBe("UNSUPPORTED");
    expect(c.lastPreviewSealed).toBeNull();
  });

  it("an echo from the shop's own app is an outbound message and leaves the thread read", async () => {
    const personKey = `p-echo-${RUN}`;
    await hand("inbound-message", [inbound({ personKey, occurredAt: at(1) })]);
    const echo: FactOf<"outbound-echo"> = { ...inbound({ personKey, occurredAt: at(2), text: "Yes, in stock" }), kind: "outbound-echo" };
    await hand("outbound-echo", [echo]);
    const c = await conversationOf(wa, personKey);
    expect(c.unread).toBe(false);
    expect(c.messages.at(-1)).toMatchObject({ direction: "OUT", author: "APP", state: "SENT" });
  });

  it("Instagram's echo of a message we sent through the API is not stored a second time", async () => {
    const personKey = `p-own-${RUN}`;
    await hand("inbound-message", [inbound({ personKey, connectionId: ig, platform: "instagram", occurredAt: at(1) })]);
    const c = await conversationOf(ig, personKey);
    const { prisma } = await import("@server/shared/prisma");
    const mid = `mid-own-${RUN}`;
    // A member's send as unit 3 will write it: our row, with Instagram's id once sent.
    await prisma.message.create({
      data: { conversationId: c.id, orgId, direction: "OUT", author: "MEMBER", kind: "TEXT", dedupeKey: `own-${RUN}`, platformMessageId: mid, state: "SENT", sentAt: at(2) },
    });
    const echo: FactOf<"outbound-echo"> = { ...inbound({ personKey, connectionId: ig, platform: "instagram", messageId: mid, occurredAt: at(2) }), kind: "outbound-echo" };
    await hand("outbound-echo", [echo]);
    expect((await conversationOf(ig, personKey)).messages.map((m) => m.author)).toEqual(["PERSON", "MEMBER"]);
  });

  it("D2: a status never lowers a message: READ then a late DELIVERED stays READ", async () => {
    const personKey = `p-status-${RUN}`;
    const echo: FactOf<"outbound-echo"> = { ...inbound({ personKey }), kind: "outbound-echo" };
    await hand("outbound-echo", [echo]);
    const status = (s: FactOf<"message-status">["status"]): FactOf<"message-status"> => ({
      kind: "message-status",
      key: `st-${Math.random()}`,
      connectionId: wa,
      platform: "whatsapp",
      occurredAt: at(3),
      messageId: echo.messageId,
      status: s,
      recipientKey: null,
      callbackRef: null,
      errorCode: null,
      pricingCategory: null,
      billable: null,
      windowClosesAt: null,
    });
    await hand("message-status", [status("read")]);
    const read = await conversationOf(wa, personKey);
    await hand("message-status", [status("delivered")]);
    const after = await conversationOf(wa, personKey);
    expect(after.messages[0].state).toBe("READ");
    expect(after.messages[0].changeSeq).toBe(read.messages[0].changeSeq);
    expect(read.changeSeq).toBeGreaterThan(BigInt(0));
  });

  it("a status for another shop's message changes nothing here", async () => {
    const personKey = `p-cross-${RUN}`;
    const echo: FactOf<"outbound-echo"> = { ...inbound({ personKey }), kind: "outbound-echo" };
    await hand("outbound-echo", [echo]);
    await hand("message-status", [
      {
        kind: "message-status", key: `x-${RUN}`, connectionId: otherWa, platform: "whatsapp", occurredAt: at(3), messageId: echo.messageId, status: "read",
        recipientKey: null, callbackRef: null, errorCode: null, pricingCategory: null, billable: null, windowClosesAt: null,
      },
    ]);
    expect((await conversationOf(wa, personKey)).messages[0].state).toBe("SENT");
  });

  it("a comment and its replies are one thread under the post; the shop's reply is outbound", async () => {
    const comment = (over: Partial<FactOf<"comment">>): FactOf<"comment"> => ({
      kind: "comment", key: `c-${Math.random()}`, connectionId: ig, platform: "instagram", occurredAt: at(1),
      personKey: `commenter-${RUN}`, personScopedId: null, personName: null, personHandle: "ayesha.k", personPhone: null,
      commentId: `cm-${Math.random()}`, parentId: null, mediaId: `post-${RUN}`, text: "Price?", ...over,
    });
    const top = comment({});
    await hand("comment", [top, comment({ parentId: top.commentId, personKey: `IG-a-${RUN}`, personHandle: "shop", occurredAt: at(2), text: "DM'd you" })]);
    const c = await conversationOf(ig, top.personKey);
    expect(c).toMatchObject({ kind: "COMMENT", postRef: `post-${RUN}`, personHandle: "ayesha.k", unread: false });
    expect(c.messages.map((m) => m.direction)).toEqual(["IN", "OUT"]);
  });

  it("reactions and edits join the thread without becoming its newest message", async () => {
    const fact = inbound({ personKey: `p-react-${RUN}`, occurredAt: at(1) });
    await hand("inbound-message", [fact]);
    const before = await conversationOf(wa, fact.personKey);
    const person = { personKey: fact.personKey, personScopedId: null, personName: null, personHandle: null, personPhone: null };
    await hand("reaction", [{ kind: "reaction", key: `r-${RUN}`, connectionId: wa, platform: "whatsapp", occurredAt: at(4), ...person, messageId: fact.messageId, emoji: "👍" }]);
    await hand("message-edit", [{ kind: "message-edit", key: `e-${RUN}`, connectionId: wa, platform: "whatsapp", occurredAt: at(5), ...person, messageId: fact.messageId, text: "size L?" }]);
    const after = await conversationOf(wa, fact.personKey);
    expect(after.messages.map((m) => [m.kind, m.refersTo])).toEqual([["TEXT", null], ["REACTION", fact.messageId], ["EDIT", fact.messageId]]);
    expect(after.lastMessageAt).toEqual(before.lastMessageAt);
    expect(after.changeSeq).toBeGreaterThan(before.changeSeq);
  });

  it("the shop's own reaction in Instagram's app makes no conversation with itself", async () => {
    const self = `IG-a-${RUN}`;
    const person = { personKey: self, personScopedId: self, personName: null, personHandle: null, personPhone: null };
    await hand("reaction", [{ kind: "reaction", key: `rs-${RUN}`, connectionId: ig, platform: "instagram", occurredAt: at(6), ...person, messageId: "mid-x", emoji: "❤️" }]);
    const { prisma } = await import("@server/shared/prisma");
    expect(await prisma.conversation.count({ where: { connectionId: ig, personKey: self } })).toBe(0);
  });

  it("a cart lands as one sealed CART message with no prices", async () => {
    const personKey = `p-cart-${RUN}`;
    const cart: FactOf<"cart-order"> = {
      kind: "cart-order", key: `k-${RUN}`, connectionId: wa, platform: "whatsapp", occurredAt: at(1),
      personKey, personScopedId: null, personName: null, personHandle: null, personPhone: null,
      messageId: `cart-${RUN}`, catalogueId: "cat-1", note: null, items: [{ retailerId: "SKU-1", quantity: 2 }],
    };
    await hand("cart-order", [cart]);
    const c = await conversationOf(wa, personKey);
    expect(c.messages[0]).toMatchObject({ kind: "CART" });
    expect(c.lastPreviewSealed).toBeNull();
  });

  it("a fact naming no connection is refused as permanent, never retried forever", async () => {
    const { PermanentFactError } = await import("@server/shared/social-events/sinks");
    await expect(hand("inbound-message", [inbound({ connectionId: "no-such-connection" }) as SocialFact as FactOf<"inbound-message">])).rejects.toBeInstanceOf(PermanentFactError);
  });
});
