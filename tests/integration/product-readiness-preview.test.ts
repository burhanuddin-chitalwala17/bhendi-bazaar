/**
 * The readiness preview, through its route against a real schema (product-form U2; spec R5, A3;
 * D4, Q8). It judges unsaved answers by the rules a save would — filled from the family as a save
 * fills them — writes nothing, and reads only the caller's own shop.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { CHANNEL } from "@server/shared/channels";
import { FACT, ORIGIN } from "@server/listing/listing-facts";
import { LISTING_PROBLEM } from "@server/listing/channel-readiness";
import { isDisposableDb, ensureFixtures, ensureOrgMember } from "../helpers/test-db";

// The real membership check runs; only the session is stubbed, so the scope is the seat's org.
const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/admin-auth", () => ({
  requireSession: async () => ({ user: { id: session.userId } }),
}));

describe.skipIf(!isDisposableDb)("readiness preview (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let POST: typeof import("@/app/api/org/[orgId]/products/readiness/route").POST;
  const stamp = `prp-${Date.now().toString(36)}`;
  const typeKey = `${stamp}-kurta`;
  const theirNode = `${stamp}-KURTA`;
  let orgId: string;
  let otherOrgId: string;
  let categoryId: string;
  let familyId: string;

  async function ask(body: unknown, asOrg = orgId) {
    const response = await POST(
      new NextRequest(`https://example.invalid/api/org/${asOrg}/products/readiness`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ orgId: asOrg }) },
    );
    return { status: response.status, body: await response.json() };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ POST } = await import("@/app/api/org/[orgId]/products/readiness/route"));
    let userId: string;
    ({ orgId, otherOrgId, userId } = await ensureFixtures());
    session.userId = userId;
    await ensureOrgMember(orgId, userId);
    // A seat in the second shop would let the 403 below pass for the wrong reason.
    await prisma.orgMember.deleteMany({ where: { orgId: otherOrgId, userId } });

    await prisma.productType.create({
      data: {
        key: typeKey,
        label: "Kurta (test)",
        facts: [FACT.MATERIAL, FACT.COLOUR],
        measures: [],
        variantAxis: [],
        kinds: [],
        factLabels: { [FACT.MATERIAL]: "Fabric" },
        labelFrom: [],
      },
    });
    categoryId = (
      await prisma.category.create({
        data: { slug: `${stamp}-kurta`, name: `Kurta ${stamp}`, description: "", heroImage: "/brand/bhendi-bazaar.png", productType: typeKey },
        select: { id: true },
      })
    ).id;
    await prisma.channelCategoryMap.create({
      data: { channel: CHANNEL.AMAZON, productType: typeKey, kind: null, theirCategory: theirNode, fit: "EXACT", checkedOn: new Date() },
    });
    await prisma.channelAttributeMap.create({
      data: { channel: CHANNEL.AMAZON, theirCategory: theirNode, fact: FACT.MATERIAL, theirAttribute: "material", required: true, freeText: true, checkedOn: new Date() },
    });
    familyId = (
      await prisma.productFamily.create({
        data: { orgId, name: `Family ${stamp}`, productType: typeKey, facts: { [FACT.MATERIAL]: { value: "velvet", origin: ORIGIN.PRODUCT } } },
        select: { id: true },
      })
    ).id;
    await prisma.orgChannel.upsert({
      where: { orgId_channel: { orgId, channel: CHANNEL.AMAZON } },
      create: { orgId, channel: CHANNEL.AMAZON, enabled: true },
      update: { enabled: true },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.orgChannel.deleteMany({ where: { orgId } });
    await prisma.productFamily.deleteMany({ where: { id: familyId } });
    await prisma.channelAttributeMap.deleteMany({ where: { theirCategory: theirNode } });
    await prisma.channelCategoryMap.deleteMany({ where: { productType: typeKey } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.productType.deleteMany({ where: { key: typeKey } });
  });

  it("names the fact Amazon will still ask of the unsaved product (spec A3)", async () => {
    const before = await prisma.product.count({ where: { orgId } });
    const { status, body } = await ask({ categoryId, facts: { [FACT.COLOUR]: "black" } });

    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].channel).toBe(CHANNEL.AMAZON);
    expect(body[0].report.problems).toContainEqual({ problem: LISTING_PROBLEM.MISSING_FACT, fact: FACT.MATERIAL, theirAttribute: "material" });
    // A preview, never a save (D4).
    expect(await prisma.product.count({ where: { orgId } })).toBe(before);
  });

  it("an answer typed in the form clears it before saving (Q8)", async () => {
    const { body } = await ask({ categoryId, facts: { [FACT.MATERIAL]: "velvet" } });
    expect(body[0].report.problems).toEqual([]);
  });

  it("fills from the family as a save would, so the hint agrees with the saved verdict (Q8)", async () => {
    const { body } = await ask({ categoryId, familyId, facts: {} });
    expect(body[0].report.problems).toEqual([]);
  });

  it("a shop selling nowhere else gets nothing (spec R5)", async () => {
    await prisma.orgChannel.update({ where: { orgId_channel: { orgId, channel: CHANNEL.AMAZON } }, data: { enabled: false } });
    try {
      const { body } = await ask({ categoryId, facts: {} });
      expect(body).toEqual([]);
    } finally {
      await prisma.orgChannel.update({ where: { orgId_channel: { orgId, channel: CHANNEL.AMAZON } }, data: { enabled: true } });
    }
  });

  it("refuses a caller with no seat in that shop, so another shop's channels never leak", async () => {
    const { status } = await ask({ categoryId, facts: {} }, otherOrgId);
    expect(status).toBe(403);
  });

  it("says nothing before a category is chosen", async () => {
    const { status, body } = await ask({ categoryId: "", facts: {} });
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it("refuses a body that is not the readiness shape, in the envelope", async () => {
    const { status, body } = await ask({ categoryId, facts: "fabric" });
    expect(status).toBe(400);
    expect(body.error).toBeDefined();
  });
});
