/**
 * Write a caption against a real schema (ai-images/social-posts unit 3; D3–D5; A3, A4): the facts are
 * the live product's with its offer, a draft stating a price the product lacks is never shown, the
 * shop pays once per call, and a price changed after drafting is caught and swapped. The text model
 * is a fake adapter and the rate a fixed one: nothing goes near a provider. Owns its fixtures.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const answers: string[] = [];
const fakeText = vi.fn(async () => ({ text: answers.shift() ?? "", inputTokens: 400, outputTokens: 120 }));
const fake = { key: "gemini", isConfigured: () => true, call: vi.fn(), callText: fakeText };
vi.mock("@server/content/generation/adapters", () => ({ ADAPTERS: { gemini: fake, gateway: { ...fake, isConfigured: () => false }, fal: { ...fake, isConfigured: () => false } } }));
vi.mock("@server/content/generation/exchange-rate", () => {
  const rate = { day: new Date("2026-11-25"), paisePerUsd: 8_500 };
  return { rateFor: async () => rate, storedRateOrFetch: async () => rate };
});

describe.skipIf(!isDisposableDb)("caption drafts (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let captionService: typeof import("@server/content/caption.service").captionService;
  let fx: Awaited<ReturnType<typeof ensureFixtures>>;
  const stamp = `caption-${Date.now().toString(36)}`;
  let productId: string;
  let postId: string;
  const runLines = () =>
    prisma.creditLine.findMany({ where: { orgId: fx.orgId, enhancementId: { startsWith: "caption-" }, createdAt: { gte: startedAt } } });
  const startedAt = new Date();

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ captionService } = await import("@server/content/caption.service"));
    fx = await ensureFixtures();
    const product = await prisma.product.create({
      data: {
        slug: stamp,
        name: `${stamp} Nida abaya`,
        description: "Created by tests/integration/caption-drafts.test.ts",
        price: 130_000,
        categoryId: fx.categoryId,
        orgId: fx.orgId,
        thumbnail: "/brand/bhendi-bazaar.png",
      },
      select: { id: true },
    });
    productId = product.id;
    await prisma.promotion.create({
      data: {
        label: `${stamp} 20% off`, scope: "ORG", orgId: fx.orgId, trigger: "AUTOMATIC",
        valueType: "PERCENT", percentBps: 2000,
        startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000),
        targets: { create: [{ productId }] },
      },
    });
    const post = await prisma.post.create({
      data: { orgId: fx.orgId, createdById: fx.userId, productIds: [productId] },
      select: { id: true },
    });
    postId = post.id;
  });

  beforeEach(() => {
    answers.length = 0;
    fakeText.mockClear();
  });

  afterAll(async () => {
    await prisma.captionDraft.deleteMany({ where: { postId } });
    await prisma.post.deleteMany({ where: { id: postId } });
    await prisma.creditLine.deleteMany({ where: { orgId: fx.orgId, enhancementId: { startsWith: "caption-" }, createdAt: { gte: startedAt } } });
    await prisma.generation.deleteMany({ where: { idempotencyKey: { startsWith: "caption-" }, createdAt: { gte: startedAt } } });
    await prisma.promotionTarget.deleteMany({ where: { productId } });
    await prisma.promotion.deleteMany({ where: { label: { startsWith: stamp } } });
    await prisma.product.deleteMany({ where: { id: productId } });
  });

  it("drafts a caption with the offer price and hashtags, from the live product, paid once (spec A3)", async () => {
    answers.push("Nida abaya, now ₹1,040 (was ₹1,300), 20% off! #abaya #modest");
    const before = await runLines();
    const draft = await captionService.write(fx.orgId, { postId, productIds: [productId], language: "en" });
    expect(draft).toEqual({ caption: "Nida abaya, now ₹1,040 (was ₹1,300), 20% off! #abaya #modest", source: "model", language: "en" });
    const prompt = (fakeText.mock.calls[0] as unknown as [unknown, { prompt: string }])[1].prompt;
    expect(prompt).toContain("₹1,040");
    const lines = (await runLines()).filter((line) => !before.some((b) => b.id === line.id));
    expect(lines.map((line) => line.kind).sort()).toEqual(["ADJUSTMENT", "CHARGE"]);
    const net = lines.reduce((sum, line) => sum + line.amountPaise, 0);
    expect(net).toBeLessThan(0);
    const generation = await prisma.generation.findFirst({ where: { purpose: "caption", createdAt: { gte: startedAt } }, orderBy: { createdAt: "desc" } });
    expect(-net).toBe(generation?.costPaise);
  });

  it("never shows a draft with an invented price: retried once, then the template (D3)", async () => {
    answers.push("Only ₹899 today! #abaya", "Grab it at ₹799 #abaya");
    const draft = await captionService.write(fx.orgId, { postId, productIds: [productId], language: "hi" });
    expect(fakeText).toHaveBeenCalledTimes(2);
    expect(draft.source).toBe("template");
    expect(draft.caption).toContain("₹1,040");
    expect(draft.caption).not.toMatch(/899|799/);
  });

  it("warns when the price changes after drafting, and Update price swaps only the number (spec A4)", async () => {
    answers.push("Nida abaya, now ₹1,040! #abaya");
    const { caption } = await captionService.write(fx.orgId, { postId, productIds: [productId], language: "en" });
    expect(await captionService.captionStillTrue(postId, caption)).toBe(true);

    await prisma.product.update({ where: { id: productId }, data: { price: 125_000 } });
    expect(await captionService.captionStillTrue(postId, caption)).toBe(false);
    // A caption the shop already corrected by hand is not held (Q50).
    expect(await captionService.captionStillTrue(postId, "Nida abaya, now ₹1,000! #abaya")).toBe(true);
    await expect(captionService.withLivePrices(postId, caption)).resolves.toBeTruthy();
    expect(await captionService.priceChanges(postId, caption)).toEqual([{ productId, wasPaise: 104_000, nowPaise: 100_000, rewritable: true }]);

    const updated = await captionService.withLivePrices(postId, caption);
    expect(updated.caption).toBe("Nida abaya, now ₹1,000! #abaya");
    await captionService.restateWritten(postId, updated.changes);
    expect(await captionService.captionStillTrue(postId, updated.caption)).toBe(true);

    // A new draft at today's price does not hide the older caption the shop may have kept (Add below).
    answers.push("Nida abaya, now ₹1,000! #abaya");
    await captionService.write(fx.orgId, { postId, productIds: [productId], language: "en" });
    await prisma.product.update({ where: { id: productId }, data: { price: 120_000 } });
    expect(await captionService.captionStillTrue(postId, updated.caption)).toBe(false);
  });

  it("asks in the chosen language, and gives back every paisa when no model answers (spec A3, D5)", async () => {
    fakeText.mockRejectedValueOnce(new (await import("@server/content/generation/generation.types")).GenerationFailure("UNAVAILABLE", "down"));
    const before = await runLines();
    const draft = await captionService.write(fx.orgId, { postId, productIds: [productId], language: "hi" });
    expect(draft.source).toBe("template");
    const prompt = (fakeText.mock.calls[0] as unknown as [unknown, { prompt: string }])[1].prompt;
    expect(prompt).toContain("Hindi");
    const lines = (await runLines()).filter((line) => !before.some((b) => b.id === line.id));
    expect(lines.map((line) => line.kind).sort()).toEqual(["CHARGE", "REFUND"]);
    expect(lines.reduce((sum, line) => sum + line.amountPaise, 0)).toBe(0);
  });

  it("Update price saves the swapped caption at the version read, then nothing is stale (spec A4)", async () => {
    const { postCaptionService } = await import("@server/social/post-caption.service");
    await prisma.product.update({ where: { id: productId }, data: { price: 130_000 } });
    answers.push("Nida abaya, now ₹1,040! #abaya");
    const { caption } = await postCaptionService.write(fx.orgId, postId, "en");
    const before = await prisma.post.update({ where: { id: postId }, data: { caption }, select: { version: true } });
    await prisma.product.update({ where: { id: productId }, data: { price: 125_000 } });

    const { post, changes } = await postCaptionService.updatePrice(fx.orgId, postId);
    expect(post.caption).toBe("Nida abaya, now ₹1,000! #abaya");
    expect(post.version).toBe(before.version + 1);
    expect(changes).toHaveLength(1);
    expect(await postCaptionService.priceChanges(fx.orgId, postId)).toEqual([]);
  });

  it("refuses a post with no product of the shop's", async () => {
    await expect(captionService.write(fx.orgId, { postId, productIds: [], language: "en" })).rejects.toThrow(/Add a product first/);
  });
});
