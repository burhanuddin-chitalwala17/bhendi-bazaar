/**
 * Meta's webhook intake against a real database (meta-foundation unit 2, ADR-0084): a signed
 * delivery is stored once however often Meta sends it, a forged one stores nothing, each event
 * reaches only the shop its number belongs to, and events for accounts no shop holds are counted.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const SECRET = "integration-whatsapp-secret";
const RUN = Date.now();
const SHOP_A = { phone: `PHONE-A-${RUN}`, business: `WABA-A-${RUN}` };
const SHOP_B = { phone: `PHONE-B-${RUN}`, business: `WABA-B-${RUN}` };
const DAY = new Date().toISOString().slice(0, 10);

function delivery(messageId: string, to: { phone: string; business: string }) {
  return Buffer.from(
    JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: to.business,
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: to.phone },
                messages: [{ id: messageId, from: "919811111111", timestamp: "1764000000", type: "text", text: { body: "hi" } }],
              },
            },
          ],
        },
      ],
    }),
  );
}

/** Two shops' numbers in one delivery, as Meta may batch them. */
function twoShopDelivery(messageId: string) {
  const change = (to: { phone: string }) => ({
    field: "messages",
    value: { metadata: { phone_number_id: to.phone }, messages: [{ id: messageId, timestamp: "1764000000", type: "text" }] },
  });
  return Buffer.from(
    JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        { id: SHOP_A.business, changes: [change(SHOP_A)] },
        { id: SHOP_B.business, changes: [change(SHOP_B), { field: "account_update", value: { event: "VERIFIED_ACCOUNT" } }] },
      ],
    }),
  );
}

const sign = (raw: Buffer, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;

describe.skipIf(!isDisposableDb)("Meta webhook intake (local db)", () => {
  const connections = { a: "", b: "" };

  beforeAll(async () => {
    process.env.META_APP_SECRET = SECRET;
    const { prisma } = await import("@server/shared/prisma");
    const { orgId, otherOrgId } = await ensureFixtures();
    await prisma.channelConnection.deleteMany({ where: { orgId: { in: [orgId, otherOrgId] }, channel: "whatsapp" } });
    const make = (org: string, shop: { phone: string; business: string }) =>
      prisma.channelConnection.create({
        data: { orgId: org, channel: "whatsapp", state: "CONNECTED", accessToken: "sealed-placeholder", externalPhoneId: shop.phone, externalBusinessId: shop.business },
        select: { id: true },
      });
    connections.a = (await make(orgId, SHOP_A)).id;
    connections.b = (await make(otherOrgId, SHOP_B)).id;
  });

  beforeEach(async () => {
    const { resetForgedCounts } = await import("@server/channels/meta-intake.service");
    resetForgedCounts();
  });

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { id: { in: [connections.a, connections.b] } } });
  });

  async function counts() {
    const { prisma } = await import("@server/shared/prisma");
    const row = await prisma.metaUnroutedCount.findUnique({ where: { day_product: { day: new Date(DAY), product: "whatsapp" } } });
    return { unrouted: row?.unrouted ?? 0, badSignature: row?.badSignature ?? 0 };
  }

  async function rowsFor(messageId: string) {
    const { prisma } = await import("@server/shared/prisma");
    return prisma.metaEvent.findMany({ where: { dedupeKey: { endsWith: `:msg:${messageId}` } }, orderBy: { connectionId: "asc" } });
  }

  it("stores a signed event once, however often Meta sends it, payload sealed (spec A1)", async () => {
    const { metaIntakeService } = await import("@server/channels/meta-intake.service");
    const id = `wamid.once-${RUN}`;
    const raw = delivery(id, SHOP_A);
    const first = await metaIntakeService.receive("whatsapp", raw, sign(raw));
    const again = await metaIntakeService.receive("whatsapp", raw, sign(raw));
    expect(first).toEqual({ kind: "accepted", result: { stored: 1, duplicates: 0, unrouted: 0 } });
    expect(again).toEqual({ kind: "accepted", result: { stored: 0, duplicates: 1, unrouted: 0 } });
    const rows = await rowsFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ connectionId: connections.a, state: "PENDING", field: "messages" });
    expect(rows[0].sealedPayload).not.toContain("919811111111");
  });

  it("five simultaneous deliveries of one event store one row", async () => {
    const { metaIntakeService } = await import("@server/channels/meta-intake.service");
    const id = `wamid.race-${RUN}`;
    const raw = delivery(id, SHOP_A);
    await Promise.all(Array.from({ length: 5 }, () => metaIntakeService.receive("whatsapp", raw, sign(raw))));
    expect(await rowsFor(id)).toHaveLength(1);
  });

  it("each shop's event reaches that shop only, in one delivery for two accounts", async () => {
    const { metaIntakeService } = await import("@server/channels/meta-intake.service");
    const { prisma } = await import("@server/shared/prisma");
    const id = `wamid.both-${RUN}`;
    const raw = twoShopDelivery(id);
    const outcome = await metaIntakeService.receive("whatsapp", raw, sign(raw));
    expect(outcome).toEqual({ kind: "accepted", result: { stored: 3, duplicates: 0, unrouted: 0 } });
    // The same Meta id for two accounts is two events, one per shop.
    const rows = await rowsFor(id);
    expect(rows.map((row) => row.connectionId).sort()).toEqual([connections.a, connections.b].sort());
    const accountChange = await prisma.metaEvent.findFirst({ where: { field: "account_update", externalAccountId: SHOP_B.business } });
    expect(accountChange?.connectionId).toBe(connections.b);
  });

  it("refuses a second live shop on a number another shop holds", async () => {
    const { prisma } = await import("@server/shared/prisma");
    await expect(
      prisma.channelConnection.update({ where: { id: connections.b }, data: { externalPhoneId: SHOP_A.phone } }),
    ).rejects.toThrow(/Unique constraint|one_shop_per_phone/);
  });

  it("refuses a forged delivery and stores nothing of it (spec A2)", async () => {
    const { metaIntakeService } = await import("@server/channels/meta-intake.service");
    const id = `wamid.forged-${RUN}`;
    const raw = delivery(id, SHOP_A);
    const before = await counts();
    const outcome = await metaIntakeService.receive("whatsapp", raw, sign(raw, "not-our-secret"));
    expect(outcome).toEqual({ kind: "refused", reason: "signature" });
    expect(await rowsFor(id)).toHaveLength(0);
    expect((await counts()).badSignature).toBe(before.badSignature + 1);
  });

  it("refuses a body changed by a byte the signature did not cover", async () => {
    const { metaIntakeService } = await import("@server/channels/meta-intake.service");
    const raw = delivery(`wamid.bytes-${RUN}`, SHOP_A);
    const signature = sign(raw);
    const tampered = Buffer.concat([raw, Buffer.from([0xff])]);
    expect(await metaIntakeService.receive("whatsapp", tampered, signature)).toEqual({ kind: "refused", reason: "signature" });
  });

  it("counts an event for a number no shop holds, never falling back to the account's shop (spec R5)", async () => {
    const { metaIntakeService } = await import("@server/channels/meta-intake.service");
    const id = `wamid.stranger-${RUN}`;
    const raw = delivery(id, { phone: "PHONE-NOBODY", business: SHOP_A.business });
    const before = await counts();
    const outcome = await metaIntakeService.receive("whatsapp", raw, sign(raw));
    expect(outcome).toEqual({ kind: "accepted", result: { stored: 0, duplicates: 0, unrouted: 1 } });
    expect(await rowsFor(id)).toHaveLength(0);
    expect((await counts()).unrouted).toBe(before.unrouted + 1);
  });
});
