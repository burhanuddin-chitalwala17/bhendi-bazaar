/**
 * Several marketplace types per type of ours, exactly one publishing (marketplace-facts Q18, Q26,
 * D3). Rows are test-owned: socks on Meesho, which no reference row covers.
 */
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("marketplace types read and publishing (local db)", () => {
  const where = { channel: "meesho", productType: "socks" } as const;
  let prisma: typeof import("@server/shared/prisma").prisma;
  let repo: typeof import("@server/listing/channel-map.repository").channelMapRepository;
  let register: typeof import("@server/listing/channel-register.service").channelRegisterService;

  beforeEach(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelMapRepository: repo } = await import("@server/listing/channel-map.repository"));
    ({ channelRegisterService: register } = await import("@server/listing/channel-register.service"));
    await prisma.channelCategoryMap.deleteMany({ where });
  });
  afterAll(async () => {
    await prisma.channelCategoryMap.deleteMany({ where });
  });

  const publishing = () => repo.setCategory({ ...where, kind: null, theirCategory: "SOCKS", fit: "EXACT", checkedOn: new Date() });

  it("keeps one publishing row and any number read only; readiness sees the publishing one (D3)", async () => {
    await publishing();
    await register.addType({ ...where, kind: null, theirCategory: "SOCKSHOSIERY" });
    const all = await prisma.channelCategoryMap.findMany({ where, select: { theirCategory: true, publishes: true } });
    expect(all).toHaveLength(2);
    expect(all.filter((r) => r.publishes).map((r) => r.theirCategory)).toEqual(["SOCKS"]);

    const forReadiness = await repo.registersFor({ channels: ["meesho"], productTypes: ["socks"], lists: [] });
    expect(forReadiness.categories.map((r) => r.theirCategory)).toEqual(["SOCKS"]);
  });

  it("refuses a second publishing row for the same type and kind, in the database", async () => {
    await publishing();
    await expect(
      prisma.channelCategoryMap.create({
        data: { ...where, kind: null, theirCategory: "OTHER", fit: "EXACT", publishes: true, checkedOn: new Date() },
      }),
    ).rejects.toThrow(/Unique constraint|unique/i);
  });

  it("moves publishing to another type in one step, and refuses removing the publishing one (Q26)", async () => {
    const first = await publishing();
    const second = await register.addType({ ...where, kind: null, theirCategory: "SOCKSHOSIERY" });
    await expect(register.removeType(first.id, "Socks")).rejects.toThrow(/Socks needs one type it publishes to\. Mark another first\./);

    await register.markPublishing(second.id);
    const rows = await prisma.channelCategoryMap.findMany({ where, select: { id: true, publishes: true } });
    expect(rows.find((r) => r.id === second.id)?.publishes).toBe(true);
    expect(rows.find((r) => r.id === first.id)?.publishes).toBe(false);

    await register.removeType(first.id, "Socks");
    expect(await prisma.channelCategoryMap.count({ where })).toBe(1);
  });

  it("undoing \"not sold\" removes only the publishing row, never the read ones (D3)", async () => {
    await repo.setCategory({ ...where, kind: null, theirCategory: null, notSold: true, fit: "EXACT", checkedOn: new Date() });
    await register.addType({ ...where, kind: null, theirCategory: "SOCKSHOSIERY" });
    await repo.clearCategory({ ...where, kind: null });
    const left = await prisma.channelCategoryMap.findMany({ where, select: { theirCategory: true, publishes: true } });
    expect(left).toEqual([{ theirCategory: "SOCKSHOSIERY", publishes: false }]);
  });

  it("lists the same marketplace type once per type and kind", async () => {
    await register.addType({ ...where, kind: null, theirCategory: "SOCKSHOSIERY" });
    await expect(register.addType({ ...where, kind: null, theirCategory: "SOCKSHOSIERY" })).rejects.toThrow(/already listed here/);
  });
});
