/**
 * social-selling/whatsapp-sending unit 1 against a real schema: the port's consent, how-often and
 * spend checks in one transaction, Send held, and the settings (D1, D4, D6; A2, A3, A6).
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("whatsapp sending port (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let port: typeof import("@server/campaigns/whatsapp-send.service").whatsAppSendService;
  let settings: typeof import("@server/campaigns/messaging-settings.service").messagingSettingsService;
  let audience: typeof import("@server/audience/audience.service").audienceService;
  let C: typeof import("@server/campaigns/campaigns.types");
  let A: typeof import("@server/audience/consent.types");
  let rates: typeof import("@server/campaigns/rates").WHATSAPP_RATES;

  const stamp = `ws${Date.now().toString(36)}`;
  let shop: string;
  let other: string;
  let actor: string;
  let n = 0;

  const contact = async (opted = true) => {
    const c = await prisma.contact.create({
      data: { orgId: shop, phoneE164: `+9197${String(Date.now()).slice(-6)}${String(++n).padStart(2, "0")}`, source: A.CONTACT_SOURCE.ORDER },
      select: { id: true },
    });
    if (opted) {
      await audience.recordOptIn({ sender: shop, contactId: c.id, channel: A.CONSENT_CHANNEL.WHATSAPP, source: A.CONSENT_SOURCE.CHECKOUT_BOX, evidence: { orderId: `${stamp}-${n}` } });
    }
    return c.id;
  };

  const send = (contactId: string, purpose: "MARKETING" | "UTILITY" = "MARKETING", key = `${stamp}-${++n}`) =>
    port.deliverByWhatsApp({
      orgId: shop,
      contactId,
      template: { name: "offer", language: C.TEMPLATE_LANGUAGE.EN },
      values: { PRODUCT: "Kurta" },
      purpose: C.SEND_PURPOSE[purpose],
      sourceRef: `test:${stamp}`,
      idempotencyKey: key,
    });

  const spend = () => port.spendThisMonth(shop);
  const MARKETING = () => rates.paisePerMessage.MARKETING;

  const reset = async () => {
    const orgId = { in: [shop, other] };
    await prisma.whatsAppSend.deleteMany({ where: { orgId } });
    await prisma.marketingTouch.deleteMany({ where: { orgId } });
    await prisma.messagingSpend.deleteMany({ where: { orgId } });
    await prisma.messagingSettings.deleteMany({ where: { orgId } });
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ whatsAppSendService: port } = await import("@server/campaigns/whatsapp-send.service"));
    ({ messagingSettingsService: settings } = await import("@server/campaigns/messaging-settings.service"));
    ({ audienceService: audience } = await import("@server/audience/audience.service"));
    C = await import("@server/campaigns/campaigns.types");
    A = await import("@server/audience/consent.types");
    ({ WHATSAPP_RATES: rates } = await import("@server/campaigns/rates"));
    ({ orgId: shop, otherOrgId: other, userId: actor } = await ensureFixtures());
  });

  beforeEach(reset);

  afterAll(async () => {
    await reset();
    await prisma.adminLog.deleteMany({ where: { resourceId: { in: [shop, other] }, action: { startsWith: "MESSAGING_" } } });
    await prisma.adminLog.deleteMany({ where: { resourceId: { in: [shop, other] }, action: "WHATSAPP_HELD_SENT" } });
    await prisma.contact.deleteMany({ where: { orgId: shop, phoneE164: { startsWith: "+9197" } } });
  });

  it("skips a send to someone not opted in with the reason, and reserves nothing (spec A2)", async () => {
    await settings.setLimit(shop, actor, null);
    const answer = await send(await contact(false));
    expect(answer).toMatchObject({ outcome: C.SEND_OUTCOME.SKIPPED, reason: C.SKIP_REASON.NOT_OPTED_IN });
    expect(await spend()).toMatchObject({ reservedPaise: 0, spentPaise: 0 });
    expect(await prisma.marketingTouch.count({ where: { orgId: shop } })).toBe(0);
  });

  it("queues an opted-in marketing send, reserves its estimate in paise and counts a touch (D1)", async () => {
    await settings.setLimit(shop, actor, null);
    const buyer = await contact();
    const answer = await send(buyer);
    expect(answer).toMatchObject({ outcome: C.SEND_OUTCOME.SENT_QUEUED, estimatePaise: MARKETING() });
    expect((await spend()).reservedPaise).toBe(MARKETING());
    expect(await port.whatsAppCounts(shop, buyer)).toEqual({ today: 1, week: 1 });
    const row = await prisma.whatsAppSend.findFirstOrThrow({ where: { orgId: shop } });
    expect(row).toMatchObject({ state: C.WA_SEND_STATE.QUEUED, spendMonth: expect.stringMatching(/^\d{4}-\d{2}$/) });
  });

  it("answers a repeated idempotency key with the first outcome and writes nothing more (D1)", async () => {
    await settings.setLimit(shop, actor, null);
    const buyer = await contact();
    const first = await send(buyer, "MARKETING", `${stamp}-same`);
    const again = await send(buyer, "MARKETING", `${stamp}-same`);
    expect(again).toEqual(first);
    expect(await prisma.whatsAppSend.count({ where: { orgId: shop } })).toBe(1);
    expect((await spend()).reservedPaise).toBe(MARKETING());
  });

  it("lets one of two marketing sends to one buyer in the same second through (how-often under concurrency)", async () => {
    await settings.setLimit(shop, actor, null);
    const buyer = await contact();
    const answers = await Promise.all([send(buyer), send(buyer)]);
    expect(answers.map((a) => a.outcome).sort()).toEqual([C.SEND_OUTCOME.SENT_QUEUED, C.SEND_OUTCOME.SKIPPED].sort());
    expect(answers.find((a) => a.outcome === C.SEND_OUTCOME.SKIPPED)).toMatchObject({ reason: C.SKIP_REASON.HOW_OFTEN });
    expect((await spend()).reservedPaise).toBe(MARKETING());
  });

  it("sends an order update past the daily cap, still counting it in spend (spec A6)", async () => {
    await settings.setLimit(shop, actor, null);
    const buyer = await contact();
    await send(buyer);
    expect(await send(buyer)).toMatchObject({ outcome: C.SEND_OUTCOME.SKIPPED, reason: C.SKIP_REASON.HOW_OFTEN });
    const update = await send(buyer, "UTILITY");
    expect(update).toMatchObject({ outcome: C.SEND_OUTCOME.SENT_QUEUED, estimatePaise: rates.paisePerMessage.UTILITY });
    expect((await spend()).reservedPaise).toBe(MARKETING() + rates.paisePerMessage.UTILITY);
    expect(await port.whatsAppCounts(shop, buyer)).toEqual({ today: 1, week: 1 });
  });

  it("still asks consent of an order update (R1)", async () => {
    await settings.setLimit(shop, actor, null);
    expect(await send(await contact(false), "UTILITY")).toMatchObject({ outcome: C.SEND_OUTCOME.SKIPPED, reason: C.SKIP_REASON.NOT_OPTED_IN });
  });

  it("holds every paid send until the shop has answered the limit step (R2)", async () => {
    const answer = await send(await contact());
    expect(answer).toMatchObject({ outcome: C.SEND_OUTCOME.HELD, reason: C.HELD_REASON.LIMIT_NOT_SET });
    expect(await settings.limitSet(shop)).toBe(false);
    expect((await spend()).reservedPaise).toBe(0);
    expect(await prisma.marketingTouch.count({ where: { orgId: shop } })).toBe(0);
  });

  it("holds a send that would cross the limit, tells the shop once, and Send held after a raise queues it (spec A3)", async () => {
    await settings.setLimit(shop, actor, 10_000);
    await prisma.messagingSpend.upsert({
      where: { orgId_month: { orgId: shop, month: (await spend()).month } },
      create: { orgId: shop, month: (await spend()).month, spentPaise: 10_000 - MARKETING() + 1 },
      update: {},
    });
    const first = await send(await contact());
    const second = await send(await contact());
    expect(first).toMatchObject({ outcome: C.SEND_OUTCOME.HELD, reason: C.HELD_REASON.LIMIT, tellShop: true });
    expect(second).toMatchObject({ outcome: C.SEND_OUTCOME.HELD, reason: C.HELD_REASON.LIMIT, tellShop: false });
    expect(await spend()).toMatchObject({ reservedPaise: 0, heldCount: 2 });

    await settings.setLimit(shop, actor, 20_000);
    expect(await port.sendHeld(shop, actor)).toEqual({ queued: 2, skipped: 0, stillHeld: 0 });
    expect(await spend()).toMatchObject({ reservedPaise: 2 * MARKETING(), heldCount: 0 });
    expect(await prisma.marketingTouch.count({ where: { orgId: shop } })).toBe(2);
  });

  it("lets only as many through as fit when senders race at the limit (hazard: two callers at the cap)", async () => {
    await settings.setLimit(shop, actor, 10_000);
    const month = (await spend()).month;
    await prisma.messagingSpend.create({ data: { orgId: shop, month, spentPaise: 10_000 - 2 * MARKETING() } });
    const buyers = await Promise.all([contact(), contact(), contact(), contact()]);
    const answers = await Promise.all(buyers.map((b) => send(b)));
    expect(answers.filter((a) => a.outcome === C.SEND_OUTCOME.SENT_QUEUED)).toHaveLength(2);
    expect(answers.filter((a) => a.outcome === C.SEND_OUTCOME.HELD)).toHaveLength(2);
    const row = await prisma.messagingSpend.findUniqueOrThrow({ where: { orgId_month: { orgId: shop, month } } });
    expect(row.spentPaise + row.reservedPaise).toBe(10_000);
  });

  it("stops Send held at the first send the limit holds again, keeping the rest in order (D4)", async () => {
    const answers = [await send(await contact()), await send(await contact()), await send(await contact())];
    expect(answers.every((a) => a.outcome === C.SEND_OUTCOME.HELD)).toBe(true);
    await settings.setLimit(shop, actor, 10_000);
    const month = (await spend()).month;
    await prisma.messagingSpend.create({ data: { orgId: shop, month, spentPaise: 10_000 - MARKETING() } });
    expect(await port.sendHeld(shop, actor)).toEqual({ queued: 1, skipped: 0, stillHeld: 2 });
    const queued = await prisma.whatsAppSend.findFirstOrThrow({ where: { orgId: shop, state: C.WA_SEND_STATE.QUEUED } });
    expect(queued.id).toBe(answers[0].sendId);
  });

  it("queues a month's first burst to different buyers at once, with no spend row yet (A-D13)", async () => {
    await settings.setLimit(shop, actor, null);
    const buyers = await Promise.all([contact(), contact(), contact(), contact(), contact()]);
    const answers = await Promise.all(buyers.map((b) => send(b)));
    expect(answers.every((a) => a.outcome === C.SEND_OUTCOME.SENT_QUEUED)).toBe(true);
    expect((await spend()).reservedPaise).toBe(5 * MARKETING());
  });

  it("refuses another shop's contact as not found and writes nothing (R1)", async () => {
    await settings.setLimit(shop, actor, null);
    const theirs = await prisma.contact.create({
      data: { orgId: other, phoneE164: `+9197${String(Date.now()).slice(-6)}${String(++n).padStart(2, "0")}`, source: A.CONTACT_SOURCE.ORDER },
      select: { id: true },
    });
    try {
      await expect(send(theirs.id)).rejects.toThrow("Contact not found");
      expect(await prisma.whatsAppSend.count({ where: { orgId: shop } })).toBe(0);
    } finally {
      await prisma.contact.delete({ where: { id: theirs.id } });
    }
  });

  it("releases each held send once when two Send held taps race (D4)", async () => {
    for (let i = 0; i < 3; i++) await send(await contact());
    await settings.setLimit(shop, actor, null);
    const [a, b] = await Promise.all([port.sendHeld(shop, actor), port.sendHeld(shop, actor)]);
    expect(a.queued + b.queued).toBe(3);
    expect((await spend()).reservedPaise).toBe(3 * MARKETING());
  });

  it("moves a held row only while it is still held, so a second release is a no-op (D4)", async () => {
    const { whatsAppSendRepository: repo } = await import("@server/campaigns/whatsapp-send.repository");
    const { sendId } = await send(await contact());
    const next = { state: C.WA_SEND_STATE.QUEUED, reason: null, estimatePaise: MARKETING(), spendMonth: "2026-11" };
    expect(await prisma.$transaction((tx) => repo.release(tx, sendId, next))).toBe(true);
    expect(await prisma.$transaction((tx) => repo.release(tx, sendId, next))).toBe(false);
  });

  it("keeps settings with their defaults, refuses a limit under ₹100, and audits each change (D6, D7)", async () => {
    expect(await settings.get(shop)).toMatchObject({ limitSet: false, howOftenDay: 1, howOftenWeek: 4, version: 0 });
    await expect(settings.setLimit(shop, actor, 5_000)).rejects.toThrow("The lowest limit is ₹100.");
    const saved = await settings.setLimit(shop, actor, 100_000);
    expect(saved).toMatchObject({ limitPaise: 100_000, limitSet: true });
    const hours = { ...saved.hours, SUN: { open: "11:00", close: "18:00" } };
    expect((await settings.setHours(shop, actor, hours)).version).toBe(saved.version + 1);
    expect((await settings.hoursFor(shop)).SUN).toEqual({ open: "11:00", close: "18:00" });
    const logged = await prisma.adminLog.findMany({ where: { resourceId: shop, action: { startsWith: "MESSAGING_" }, adminId: actor } });
    expect(logged.map((l) => l.action)).toEqual(expect.arrayContaining(["MESSAGING_LIMIT_SET", "MESSAGING_HOURS_SET"]));
  });
});
