/**
 * social-selling/consent-core unit 1 against a real schema: the append-only log and its projection,
 * `may` per shop, the upload rule, and a STOP committed before a send's transaction (D1, D2; A2, A4).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("consent core (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let audience: typeof import("@server/audience/audience.service").audienceService;
  let T: typeof import("@server/audience/consent.types");
  let NotFoundError: typeof import("@server/shared/domain-error").NotFoundError;

  const stamp = `cc${Date.now().toString(36)}`;
  let shopA: string;
  let shopB: string;
  let n = 0;

  const makeContact = (orgId: string, extra: { email?: string | null; phoneE164?: string | null } = {}) =>
    prisma.contact.create({
      data: { orgId, phoneE164: `+9198${String(Date.now()).slice(-6)}${String(++n).padStart(2, "0")}`, source: T.CONTACT_SOURCE.ORDER, ...extra },
      select: { id: true, phoneE164: true },
    });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ audienceService: audience } = await import("@server/audience/audience.service"));
    T = await import("@server/audience/consent.types");
    ({ NotFoundError } = await import("@server/shared/domain-error"));
    ({ orgId: shopA, otherOrgId: shopB } = await ensureFixtures());
  });

  afterAll(async () => {
    await prisma.contact.deleteMany({ where: { orgId: { in: [shopA, shopB] }, phoneE164: { startsWith: "+9198" } } });
  });

  it("appends an event and writes the projection in one go, and the history keeps both changes (D1, R2)", async () => {
    const c = await makeContact(shopA);
    await audience.recordOptIn({ sender: shopA, contactId: c.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.CHECKOUT_BOX, evidence: { orderId: `${stamp}-o1` } });
    await audience.recordStop({ sender: shopA, contactId: c.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.CHAT_KEYWORD, evidence: { messageId: `${stamp}-m1` } });

    const events = await prisma.consentEvent.findMany({ where: { contactId: c.id }, orderBy: { at: "asc" } });
    expect(events.map((e) => e.change)).toEqual([T.CONSENT_CHANGE.OPT_IN, T.CONSENT_CHANGE.STOP]);
    expect(events.every((e) => e.orgId === shopA)).toBe(true);
    const row = await prisma.consent.findUniqueOrThrow({ where: { contactId_sender_channel: { contactId: c.id, sender: shopA, channel: T.CONSENT_CHANNEL.WHATSAPP } } });
    expect(row).toMatchObject({ state: T.CONSENT_STATE.STOPPED, sourceEventId: events[1].id });

    const history = await audience.history(shopA, c.id);
    expect(history.map((h) => h.change)).toEqual([T.CONSENT_CHANGE.STOP, T.CONSENT_CHANGE.OPT_IN]);
    expect(history[0].evidence).toEqual({ messageId: `${stamp}-m1` });
  });

  it("answers yes only to the shop the person opted in to, and no with the reason to another (spec A2)", async () => {
    const atA = await makeContact(shopA, { email: `${stamp}@example.invalid` });
    const atB = await prisma.contact.create({ data: { orgId: shopB, phoneE164: atA.phoneE164, source: T.CONTACT_SOURCE.ORDER }, select: { id: true } });
    await audience.recordOptIn({ sender: shopA, contactId: atA.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.CHAT_KEYWORD, evidence: { messageId: `${stamp}-m2` } });

    expect(await audience.may(shopA, atA.id, T.CONSENT_CHANNEL.WHATSAPP)).toEqual({ yes: true });
    expect(await audience.may(shopB, atB.id, T.CONSENT_CHANNEL.WHATSAPP)).toEqual({ yes: false, reason: T.MAY_REASON.NOT_OPTED_IN });
    expect(await audience.may(shopB, atA.id, T.CONSENT_CHANNEL.WHATSAPP)).toEqual({ yes: false, reason: T.MAY_REASON.NOT_OPTED_IN });
    expect(await audience.may(shopA, atA.id, T.CONSENT_CHANNEL.EMAIL)).toEqual({ yes: false, reason: T.MAY_REASON.NOT_OPTED_IN });
  });

  it("refuses to record a consent for a shop on another shop's contact (R1)", async () => {
    const atA = await makeContact(shopA);
    await expect(
      audience.recordOptIn({ sender: shopB, contactId: atA.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.CHAT_KEYWORD, evidence: { orderId: `${stamp}-x` } }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.consentEvent.count({ where: { contactId: atA.id } })).toBe(0);
    await expect(audience.history(shopB, atA.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps a platform consent apart from the shop's on the same contact (parent Q27)", async () => {
    const c = await makeContact(shopA, { email: `${stamp}-p@example.invalid` });
    await audience.recordOptIn({ sender: T.PLATFORM_SENDER, contactId: c.id, channel: T.CONSENT_CHANNEL.EMAIL, source: T.CONSENT_SOURCE.CHECKOUT_BOX, evidence: { orderId: `${stamp}-o2` } });
    expect(await audience.may(T.PLATFORM_SENDER, c.id, T.CONSENT_CHANNEL.EMAIL)).toEqual({ yes: true });
    expect(await audience.may(shopA, c.id, T.CONSENT_CHANNEL.EMAIL)).toEqual({ yes: false, reason: T.MAY_REASON.NOT_OPTED_IN });
    expect((await prisma.consentEvent.findFirstOrThrow({ where: { contactId: c.id } })).orgId).toBeNull();
    expect(await audience.history(shopA, c.id)).toEqual([]);
  });

  it("leaves a stopped person stopped when an upload says they opted in, and lets them opt in by chat (spec A4, R5)", async () => {
    const c = await makeContact(shopA);
    await audience.recordStop({ sender: shopA, contactId: c.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.CHAT_KEYWORD, evidence: { messageId: `${stamp}-m3` } });

    const upload = await audience.recordOptIn({ sender: shopA, contactId: c.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.FILE_UPLOAD, evidence: { file: "list.csv" } });
    expect(upload).toEqual({ changed: false, state: T.CONSENT_STATE.STOPPED });
    expect(await audience.may(shopA, c.id, T.CONSENT_CHANNEL.WHATSAPP)).toEqual({ yes: false, reason: T.MAY_REASON.STOPPED });
    expect(await prisma.consentEvent.count({ where: { contactId: c.id } })).toBe(1);

    const chat = await audience.recordOptIn({ sender: shopA, contactId: c.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.CHAT_KEYWORD, evidence: { messageId: `${stamp}-m4` } });
    expect(chat).toEqual({ changed: true, state: T.CONSENT_STATE.OPTED_IN });
    expect(await audience.may(shopA, c.id, T.CONSENT_CHANNEL.WHATSAPP)).toEqual({ yes: true });
  });

  it("keeps a person stopped when an upload races their STOP: the row lock serialises them (R5, hazard)", async () => {
    // Nobody has a row yet, so without the lock both read "Not yet" and the upload's write lands last.
    const people = await Promise.all(Array.from({ length: 12 }, () => makeContact(shopA)));
    const results = await Promise.allSettled(
      people.flatMap((c) => [
        audience.recordOptIn({ sender: shopA, contactId: c.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.FILE_UPLOAD, evidence: { file: "x.csv" } }),
        audience.recordStop({ sender: shopA, contactId: c.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.CHAT_KEYWORD, evidence: { messageId: `${stamp}-${c.id}` } }),
      ]),
    );
    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    const rows = await prisma.consent.findMany({ where: { contactId: { in: people.map((c) => c.id) } }, select: { state: true } });
    expect(rows.map((r) => r.state)).toEqual(people.map(() => T.CONSENT_STATE.STOPPED));
  });

  it("refuses a send whose transaction asks after a STOP committed (D2, hazard: a STOP racing a send)", async () => {
    const c = await makeContact(shopA);
    await audience.recordOptIn({ sender: shopA, contactId: c.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.CHECKOUT_BOX, evidence: { orderId: `${stamp}-o3` } });
    await audience.recordStop({ sender: shopA, contactId: c.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.CHAT_KEYWORD, evidence: { messageId: `${stamp}-m5` } });

    const answer = await prisma.$transaction(async (tx) => audience.may(shopA, c.id, T.CONSENT_CHANNEL.WHATSAPP, tx));
    expect(answer).toEqual({ yes: false, reason: T.MAY_REASON.STOPPED });
  });

  it("joins a caller's transaction: a consent recorded there rolls back with it", async () => {
    const c = await makeContact(shopA);
    await expect(
      prisma.$transaction(async (tx) => {
        await audience.recordOptIn({ sender: shopA, contactId: c.id, channel: T.CONSENT_CHANNEL.WHATSAPP, source: T.CONSENT_SOURCE.CHECKOUT_BOX, evidence: { orderId: `${stamp}-x` } }, tx);
        throw new Error("rolled back");
      }),
    ).rejects.toThrow("rolled back");
    expect(await prisma.consentEvent.count({ where: { contactId: c.id } })).toBe(0);
    expect(await audience.may(shopA, c.id, T.CONSENT_CHANNEL.WHATSAPP)).toEqual({ yes: false, reason: T.MAY_REASON.NOT_OPTED_IN });
  });
});
