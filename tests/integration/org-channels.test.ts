/**
 * Where a shop has said it sells, against a real schema
 * ([channel-registry](../../docs/specs/channel-registry/) D2, spec R9).
 *
 * The rule that costs something to get wrong is the default: off. A shop that has never been
 * asked must read as selling nowhere else, not as having declined — and not as having agreed.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { CHANNEL, CHANNELS, PUBLISHABLE_CHANNELS } from "@server/shared/channels";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("where a shop sells (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/catalog/org-channel.service").orgChannelService;
  let orgId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orgChannelService: service } = await import("@server/catalog/org-channel.service"));
    ({ orgId } = await ensureFixtures());
    await prisma.orgChannel.deleteMany({ where: { orgId } });
  });

  afterAll(async () => {
    await prisma.orgChannel.deleteMany({ where: { orgId } });
  });

  it("offers every channel but this storefront — a shop does not opt into where it already is", async () => {
    const choices = await service.list(orgId);
    expect(choices.map((choice) => choice.channel)).toEqual([...PUBLISHABLE_CHANNELS]);
    expect(choices.map((choice) => choice.channel)).not.toContain(CHANNEL.STORE);
    expect(choices).toHaveLength(CHANNELS.length - 1);
  });

  it("reads them all off before anything is said, and writes no row to say so", async () => {
    expect((await service.list(orgId)).every((choice) => !choice.enabled)).toBe(true);
    expect(await prisma.orgChannel.count({ where: { orgId } })).toBe(0);
  });

  it("names each one the way a shop would, not the way the code does", async () => {
    const meta = (await service.list(orgId)).find((choice) => choice.channel === CHANNEL.META);
    expect(meta?.label).toBe("Meta (Facebook & Instagram)");
    expect(meta?.kind).toBe("shopfront");
  });

  it("saves the set it was given and answers with the result", async () => {
    const saved = await service.save(orgId, [
      { channel: CHANNEL.MEESHO, enabled: true },
      { channel: CHANNEL.GOOGLE, enabled: false },
    ]);
    expect(saved.find((choice) => choice.channel === CHANNEL.MEESHO)?.enabled).toBe(true);
    expect(saved.find((choice) => choice.channel === CHANNEL.GOOGLE)?.enabled).toBe(false);
  });

  // The form sends what it showed. Treating silence as "off" would switch off whatever a later
  // release adds, the moment a page loaded before it posted.
  it("leaves a channel the body did not mention alone", async () => {
    await service.save(orgId, [{ channel: CHANNEL.FLIPKART, enabled: true }]);
    const after = await service.list(orgId);
    expect(after.find((choice) => choice.channel === CHANNEL.MEESHO)?.enabled).toBe(true);
    expect(after.find((choice) => choice.channel === CHANNEL.FLIPKART)?.enabled).toBe(true);
  });

  it("turns one off again without losing the others", async () => {
    await service.save(orgId, [{ channel: CHANNEL.MEESHO, enabled: false }]);
    const after = await service.list(orgId);
    expect(after.find((choice) => choice.channel === CHANNEL.MEESHO)?.enabled).toBe(false);
    expect(after.find((choice) => choice.channel === CHANNEL.FLIPKART)?.enabled).toBe(true);
  });

  it("goes with the shop, because it is the shop's answer and nobody else's", async () => {
    const org = await prisma.org.create({
      data: {
        code: `OCX-${Date.now().toString(36)}`,
        handle: `oc-${Date.now().toString(36)}`,
        name: "Doomed",
        email: `oc-${Date.now().toString(36)}@example.invalid`,
      },
      select: { id: true },
    });
    await service.save(org.id, [{ channel: CHANNEL.AMAZON, enabled: true }]);
    await prisma.org.delete({ where: { id: org.id } });
    expect(await prisma.orgChannel.count({ where: { orgId: org.id } })).toBe(0);
  });
});
