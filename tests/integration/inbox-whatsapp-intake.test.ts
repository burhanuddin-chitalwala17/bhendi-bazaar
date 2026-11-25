/**
 * WhatsApp's recorded webhooks into the inbox against a real database (social-selling/inbox-whatsapp unit 1):
 * Meta's envelope is split, translated and handed to the inbox's sinks, as the drain does.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isDisposableDb } from "../helpers/test-db";
import type { SocialFact } from "@server/shared/social-events/facts";

const RUN = Date.now();
const PHONE_ID = `PN-${RUN}`;
const NOW = new Date("2026-11-25T10:00:00Z");
const seconds = (minute: number) => String(Math.floor(Date.UTC(2026, 10, 25, 10, minute) / 1000));

describe.skipIf(!isDisposableDb)("WhatsApp messages land in the inbox (local db)", () => {
  let orgId = "";
  let wa = "";

  beforeAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    const org = await prisma.org.create({
      data: { code: `IWA-${RUN}`, handle: `iwa${RUN}`, name: "WhatsApp shop", email: `iwa-${RUN}@example.invalid` },
      select: { id: true },
    });
    orgId = org.id;
    wa = (
      await prisma.channelConnection.create({
        data: { orgId, channel: "whatsapp", state: "CONNECTED", accessToken: "sealed-placeholder", externalAccountId: `WABA-${RUN}`, externalPhoneId: PHONE_ID },
        select: { id: true },
      })
    ).id;
    await import("@server/inbox/inbox.sinks");
  });

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { orgId } });
    await prisma.orgDataKey.deleteMany({ where: { orgId } });
    await prisma.org.deleteMany({ where: { id: orgId } });
  });

  const envelope = (field: string, value: Record<string, unknown>) => ({
    object: "whatsapp_business_account",
    entry: [{ id: `WABA-${RUN}`, changes: [{ field, value: { messaging_product: "whatsapp", metadata: { phone_number_id: PHONE_ID }, ...value } }] }],
  });

  /** What the drain does with a stored delivery: split, translate, hand each run of one kind to the inbox's sinks. */
  async function deliver(body: unknown) {
    const { splitWebhook } = await import("@server/channels/providers/meta/webhook-split");
    const { translateEvent } = await import("@server/channels/providers/meta/translate");
    const { sinksFor } = await import("@server/shared/social-events/sinks");
    const items = splitWebhook("whatsapp", body, NOW) ?? [];
    const facts: SocialFact[] = items.flatMap((item) =>
      translateEvent({ key: item.dedupeKey, connectionId: wa, product: item.product, field: item.field, occurredAt: item.occurredAt, payload: item.payload }),
    );
    for (const fact of facts) {
      for (const sink of sinksFor(fact.kind).filter((s) => s.name.startsWith("inbox."))) await sink.handle([fact] as never);
    }
    return facts;
  }

  async function thread(threadKey: string) {
    const { prisma } = await import("@server/shared/prisma");
    return prisma.conversation.findUnique({
      where: { orgId_platform_threadKey: { orgId, platform: "whatsapp", threadKey } },
      include: { messages: { orderBy: [{ sentAt: "asc" }, { id: "asc" }] } },
    });
  }

  it("a message to the number arrives as an unread WhatsApp conversation, named and numbered (spec A1, R1)", async () => {
    await deliver(
      envelope("messages", {
        contacts: [{ profile: { name: "Ayesha" }, wa_id: "919811100001" }],
        messages: [{ id: `wamid.A1-${RUN}`, from: "919811100001", timestamp: seconds(1), type: "text", text: { body: "Is the kurta in M?" } }],
      }),
    );
    const c = await thread("dm:+919811100001");
    expect(c).toMatchObject({ platform: "whatsapp", kind: "DM", unread: true, personName: "Ayesha", personPhone: "+919811100001", connectionId: wa });
    expect(c!.messages).toHaveLength(1);
    expect(c!.messages[0]).toMatchObject({ direction: "IN", author: "PERSON", kind: "TEXT", platformMessageId: `wamid.A1-${RUN}` });
  });

  it("a buyer with no number is keyed by the scoped id and shown by username (spec A1, Q9)", async () => {
    await deliver(
      envelope("messages", {
        contacts: [{ profile: { name: "Zain", username: "@zain" }, user_id: `IN.Z-${RUN}` }],
        messages: [{ id: `wamid.Z-${RUN}`, from_user_id: `IN.Z-${RUN}`, timestamp: seconds(2), type: "text", text: { body: "hello" } }],
      }),
    );
    expect(await thread(`dm:IN.Z-${RUN}`)).toMatchObject({ personName: "Zain", personHandle: "@zain", personPhone: null });
  });

  it("a reply typed in the Business app lands in the same thread, from the app (R2)", async () => {
    await deliver(
      envelope("smb_message_echoes", {
        message_echoes: [{ id: `wamid.E-${RUN}`, from: "919800000000", to: "919811100001", timestamp: seconds(3), type: "text", text: { body: "Yes, M is in stock" } }],
      }),
    );
    const c = await thread("dm:+919811100001");
    expect(c!.messages.map((m) => [m.direction, m.author])).toEqual([["IN", "PERSON"], ["OUT", "APP"]]);
    expect(c!.unread).toBe(false);
  });

  it("a voice note, a document and a location land as what they are, the files by Meta's id (R6)", async () => {
    const from = { from: "919811100002" };
    await deliver(
      envelope("messages", {
        contacts: [{ profile: { name: "Fatima" }, wa_id: "919811100002" }],
        messages: [
          { ...from, id: `wamid.V-${RUN}`, timestamp: seconds(4), type: "audio", audio: { id: "MEDIA-V", mime_type: "audio/ogg", voice: true } },
          { ...from, id: `wamid.D-${RUN}`, timestamp: seconds(5), type: "document", document: { id: "MEDIA-D", mime_type: "application/pdf", filename: "bill.pdf" } },
          { ...from, id: `wamid.L-${RUN}`, timestamp: seconds(6), type: "location", location: { latitude: 18.95, longitude: 72.83, name: "Shop" } },
        ],
      }),
    );
    const c = await thread("dm:+919811100002");
    expect(c!.messages.map((m) => [m.kind, m.attachmentRef])).toEqual([["AUDIO", "MEDIA-V"], ["DOCUMENT", "MEDIA-D"], ["LOCATION", null]]);
    const { seal } = await import("@server/shared/seal/seal");
    const location = c!.messages[2];
    expect(JSON.parse(await seal.open({ orgId, table: "Message", rowId: location.id }, location.bodySealed!))).toEqual({ place: "Shop", latitude: 18.95, longitude: 72.83 });
    // A location is named by its kind in the list, never by its sealed structure.
    expect(c).toMatchObject({ lastMessageKind: "LOCATION", lastPreviewSealed: null });
  });

  it("user_changed_user_id re-keys the thread in place, and what follows lands in it (D1)", async () => {
    const before = await thread(`dm:IN.Z-${RUN}`);
    await deliver(
      envelope("messages", {
        messages: [{ id: `wamid.S-${RUN}`, from_user_id: `IN.Z-${RUN}`, timestamp: seconds(7), type: "system", system: { type: "user_changed_user_id", body: "changed", user_id: `IN.Z2-${RUN}` } }],
      }),
    );
    await deliver(
      envelope("messages", { messages: [{ id: `wamid.Z2-${RUN}`, from_user_id: `IN.Z2-${RUN}`, timestamp: seconds(8), type: "text", text: { body: "still me" } }] }),
    );
    expect(await thread(`dm:IN.Z-${RUN}`)).toBeNull();
    const after = await thread(`dm:IN.Z2-${RUN}`);
    expect(after!.id).toBe(before!.id);
    expect(after!.personKey).toBe(`IN.Z2-${RUN}`);
    expect(after!.messages).toHaveLength(2);
  });

  it("a re-key onto an id that already has a thread leaves both as they are", async () => {
    const msg = (id: string, user: string, minute: number) => ({ id, from_user_id: user, timestamp: seconds(minute), type: "text", text: { body: "x" } });
    await deliver(envelope("messages", { messages: [msg(`wamid.P-${RUN}`, `IN.P-${RUN}`, 9), msg(`wamid.Q-${RUN}`, `IN.Q-${RUN}`, 10)] }));
    await deliver(
      envelope("messages", {
        messages: [{ id: `wamid.S2-${RUN}`, from_user_id: `IN.P-${RUN}`, timestamp: seconds(11), type: "system", system: { type: "user_changed_user_id", user_id: `IN.Q-${RUN}` } }],
      }),
    );
    expect(await thread(`dm:IN.P-${RUN}`)).not.toBeNull();
    expect((await thread(`dm:IN.Q-${RUN}`))!.messages).toHaveLength(1);
  });

  it("the same delivery twice stores each message once (inbox-core R12)", async () => {
    const body = envelope("messages", {
      contacts: [{ profile: { name: "Sana" }, wa_id: "919811100003" }],
      messages: [{ id: `wamid.R-${RUN}`, from: "919811100003", timestamp: seconds(12), type: "image", image: { id: "MEDIA-I", mime_type: "image/jpeg" } }],
    });
    await deliver(body);
    await deliver(body);
    expect((await thread("dm:+919811100003"))!.messages).toHaveLength(1);
  });
});
