/**
 * Answering one missing fact across products (readiness-fix R1–R4) against a real schema and the
 * shipped Google mapping, which requires a colour on bags.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { isDisposableDb, ensureFixtures, setAnswers, answersOf } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("readiness fix (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let fix: typeof import("@server/listing/readiness-fix.service").readinessFixService;
  let readiness: typeof import("@server/listing/channel-readiness.service").channelReadinessService;
  let orgId: string;
  let categoryId: string;
  const stamp = Date.now();
  let hadGoogle = false;

  const bag = async (s: string, facts: Record<string, unknown> = {}) => {
    const { id } = await prisma.product.create({
      data: { name: `Bag ${s}`, slug: `rf-${stamp}-${s}`, description: "", price: 1000, categoryId, thumbnail: "/brand/bhendi-bazaar.png", orgId, productType: "bag" },
      select: { id: true },
    });
    await setAnswers(id, { facts });
    return id;
  };
  const colourOf = async (id: string) => ((await answersOf(id)).facts as Record<string, { value?: string }>).colour?.value;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ readinessFixService: fix } = await import("@server/listing/readiness-fix.service"));
    ({ channelReadinessService: readiness } = await import("@server/listing/channel-readiness.service"));
    ({ orgId, categoryId } = await ensureFixtures());
    hadGoogle = !!(await prisma.orgChannel.findUnique({ where: { orgId_channel: { orgId, channel: "google" } } }));
    await prisma.orgChannel.upsert({ where: { orgId_channel: { orgId, channel: "google" } }, create: { orgId, channel: "google", enabled: true }, update: { enabled: true } });
  });
  beforeEach(async () => prisma.product.deleteMany({ where: { orgId, slug: { startsWith: `rf-${stamp}` } } }));
  afterAll(async () => {
    await prisma.product.deleteMany({ where: { orgId, slug: { startsWith: `rf-${stamp}` } } });
    if (!hadGoogle) await prisma.orgChannel.deleteMany({ where: { orgId, channel: "google" } });
  });

  it("names a missing colour on the card and lists the products missing it (spec A1, R1, R2)", async () => {
    const a = await bag("A");
    const b = await bag("B", { colour: { value: "black", origin: "product" } });
    const missing = await readiness.missingFact(orgId, "google", "colour");
    expect(missing).toContain(a);
    expect(missing).not.toContain(b);
    const row = (await readiness.summaryForOrg(orgId)).find((r) => r.channel === "google");
    expect(row?.gaps.find((g) => g.fact === "colour")).toMatchObject({ fixable: true });
  });

  it("sets an answer only where it is empty, and names the rest (spec A3, Q5)", async () => {
    const a = await bag("SET");
    const b = await bag("TAKEN", { colour: { value: "blue", origin: "product" } });
    const result = await fix.answer(orgId, "colour", "black", [a, b]);
    expect(result).toEqual({ set: [a], skipped: [b] });
    expect(await colourOf(a)).toBe("black");
    expect(await colourOf(b)).toBe("blue");
  });

  it("refuses an answer that is not one offered (hazard, D2)", async () => {
    const a = await bag("ODD");
    await expect(fix.answer(orgId, "colour", "not-a-colour", [a])).rejects.toThrow(/answers offered/);
    expect(await colourOf(a)).toBeUndefined();
  });

  it("undoes a pick only while it is still the answer given (spec A2, R3)", async () => {
    const a = await bag("UNDO");
    await fix.answer(orgId, "colour", "black", [a]);
    expect(await fix.undo(orgId, "colour", "black", a)).toBe(true);
    expect(await colourOf(a)).toBeUndefined();
    await fix.answer(orgId, "colour", "black", [a]);
    await setAnswers(a, { facts: { colour: { value: "blue", origin: "product" } } });
    expect(await fix.undo(orgId, "colour", "black", a)).toBe(false);
    expect(await colourOf(a)).toBe("blue");
  });
});
