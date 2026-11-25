/**
 * Drafts and autosave against a real schema (social-selling/post-composer unit 1; D1, D3; R1, R6, R10):
 * a draft names only its own shop's library and products, a save is a compare-and-set on the version,
 * the destinations move with it, and duplicate starts a new draft. Owns its fixtures.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("post drafts (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let postService: typeof import("@server/social/post.service").postService;
  let fx: Awaited<ReturnType<typeof ensureFixtures>>;
  const stamp = `post-${Date.now().toString(36)}`;
  const assets: string[] = [];
  const products: string[] = [];
  let mine: string[];
  let theirs: string;
  let product: string;
  let theirProduct: string;

  async function asset(orgId: string, ready = true) {
    const row = await prisma.mediaAsset.create({
      data: { orgId, kind: "IMAGE", ref: `https://media.test/${stamp}/${assets.length}.webp`, source: "UPLOAD", state: ready ? "READY" : "PENDING" },
      select: { id: true },
    });
    assets.push(row.id);
    return row.id;
  }

  async function aProduct(orgId: string) {
    const row = await prisma.product.create({
      data: {
        slug: `${stamp}-${products.length}`,
        name: `${stamp} piece ${products.length}`,
        description: "Created by tests/integration/post-drafts.test.ts",
        price: 10_000,
        categoryId: fx.categoryId,
        orgId,
        thumbnail: "/brand/bhendi-bazaar.png",
      },
      select: { id: true },
    });
    products.push(row.id);
    return row.id;
  }

  const draft = (over: Partial<{ caption: string; mediaIds: string[]; productIds: string[]; destinations: ("IG_FEED" | "IG_STORY" | "WA_STATUS")[] }> = {}) => ({
    caption: "",
    mediaIds: [] as string[],
    productIds: [] as string[],
    destinations: [] as ("IG_FEED" | "IG_STORY" | "WA_STATUS")[],
    ...over,
  });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ postService } = await import("@server/social/post.service"));
    fx = await ensureFixtures();
    mine = [await asset(fx.orgId), await asset(fx.orgId)];
    theirs = await asset(fx.otherOrgId);
    product = await aProduct(fx.orgId);
    theirProduct = await aProduct(fx.otherOrgId);
  });

  afterAll(async () => {
    if (!prisma) return;
    const posts = await prisma.post.findMany({ where: { caption: { startsWith: stamp } }, select: { id: true } });
    const ids = posts.map((p) => p.id);
    await prisma.postDestination.deleteMany({ where: { postId: { in: ids } } });
    await prisma.post.deleteMany({ where: { id: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: products } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: assets } } });
  });

  it("keeps two library pictures, a caption with a hashtag, a product and two destinations as a draft (spec A1, R1, R6)", async () => {
    const post = await postService.createDraft(fx.orgId, fx.userId, draft({
      caption: `${stamp} New arrivals #eid`,
      mediaIds: [mine[1], mine[0]],
      productIds: [product],
      destinations: ["IG_FEED", "WA_STATUS"],
    }));
    expect(post).toMatchObject({
      state: "DRAFT",
      version: 0,
      caption: `${stamp} New arrivals #eid`,
      mediaIds: [mine[1], mine[0]],
      productIds: [product],
      scheduledAt: null,
    });
    expect([...post.destinations].sort()).toEqual(["IG_FEED", "WA_STATUS"]);
    expect(await postService.get(fx.orgId, post.id)).toEqual(post);
  });

  it("refuses another shop's picture, a picture not yet ready, and another shop's product (R1, R6)", async () => {
    const pending = await asset(fx.orgId, false);
    for (const mediaIds of [[theirs], [mine[0], pending]]) {
      await expect(postService.createDraft(fx.orgId, fx.userId, draft({ caption: stamp, mediaIds }))).rejects.toMatchObject({ field: "mediaIds" });
    }
    for (const productIds of [[theirProduct], ["no-such-product"]]) {
      await expect(postService.createDraft(fx.orgId, fx.userId, draft({ caption: stamp, productIds }))).rejects.toMatchObject({ field: "productIds" });
    }
  });

  it("autosaves at the version it saw, and a second save from that version is refused with 409 (D3, spec A4)", async () => {
    const post = await postService.createDraft(fx.orgId, fx.userId, draft({ caption: `${stamp} first`, destinations: ["IG_FEED"] }));
    const saved = await postService.saveDraft(fx.orgId, post.id, { ...draft({ caption: `${stamp} second`, mediaIds: [mine[0]], destinations: ["IG_STORY"] }), version: 0 });
    expect(saved).toMatchObject({ version: 1, caption: `${stamp} second`, mediaIds: [mine[0]], destinations: ["IG_STORY"] });

    await expect(
      postService.saveDraft(fx.orgId, post.id, { ...draft({ caption: `${stamp} stale` }), version: 0 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await postService.get(fx.orgId, post.id)).toEqual(saved);
  });

  it("of two saves racing from one version exactly one lands (D3)", async () => {
    const post = await postService.createDraft(fx.orgId, fx.userId, draft({ caption: `${stamp} race` }));
    const results = await Promise.allSettled([
      postService.saveDraft(fx.orgId, post.id, { ...draft({ caption: `${stamp} a`, destinations: ["IG_FEED"] }), version: 0 }),
      postService.saveDraft(fx.orgId, post.id, { ...draft({ caption: `${stamp} b`, destinations: ["WA_STATUS"] }), version: 0 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const stored = await postService.get(fx.orgId, post.id);
    expect(stored.version).toBe(1);
    expect(stored.destinations).toEqual(stored.caption.endsWith(" a") ? ["IG_FEED"] : ["WA_STATUS"]);
  });

  it("keeps a picked destination's plug fields when the draft is saved again (D1, D2)", async () => {
    const post = await postService.createDraft(fx.orgId, fx.userId, draft({ caption: stamp, destinations: ["IG_FEED"] }));
    await prisma.postDestination.updateMany({ where: { postId: post.id }, data: { fields: { location: "Bhendi Bazaar" } } });
    await postService.saveDraft(fx.orgId, post.id, { ...draft({ caption: stamp, destinations: ["IG_FEED", "IG_STORY"] }), version: 0 });
    const rows = await prisma.postDestination.findMany({ where: { postId: post.id }, select: { kind: true, fields: true } });
    expect(rows.find((r) => r.kind === "IG_FEED")?.fields).toEqual({ location: "Bhendi Bazaar" });
  });

  it("refuses a save to a post that is no longer a draft, and to another shop's post (R10)", async () => {
    const post = await postService.createDraft(fx.orgId, fx.userId, draft({ caption: stamp }));
    await prisma.post.update({ where: { id: post.id }, data: { state: "SCHEDULED" } });
    await expect(postService.saveDraft(fx.orgId, post.id, { ...draft({ caption: stamp }), version: 0 })).rejects.toMatchObject({ status: 409 });
    await expect(postService.saveDraft(fx.otherOrgId, post.id, { ...draft({ caption: stamp }), version: 0 })).rejects.toMatchObject({ status: 404 });
    await expect(postService.get(fx.otherOrgId, post.id)).rejects.toMatchObject({ status: 404 });
  });

  it("duplicates a post as a new draft with its media, caption, products and destinations, never its time (R10, Q7)", async () => {
    const post = await postService.createDraft(fx.orgId, fx.userId, draft({
      caption: `${stamp} dup`, mediaIds: [mine[0]], productIds: [product], destinations: ["IG_FEED", "WA_STATUS"],
    }));
    await prisma.post.update({ where: { id: post.id }, data: { state: "SCHEDULED", scheduledAt: new Date() } });
    const copy = await postService.duplicate(fx.orgId, fx.userId, post.id);
    expect(copy.id).not.toBe(post.id);
    expect(copy).toMatchObject({ state: "DRAFT", version: 0, scheduledAt: null, caption: `${stamp} dup`, mediaIds: [mine[0]], productIds: [product] });
    expect([...copy.destinations].sort()).toEqual(["IG_FEED", "WA_STATUS"]);
    await expect(postService.duplicate(fx.otherOrgId, fx.userId, post.id)).rejects.toMatchObject({ status: 404 });
  });
});
