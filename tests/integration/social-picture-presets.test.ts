/**
 * The presets a post gives Make a picture, against a real schema (ai-images/social-posts unit 1; D1,
 * R1): the post's products' main photos — the first ready library picture of each, never another
 * shop's — first product first, and the shape from its destinations. Owns its fixtures.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("social picture presets (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let postService: typeof import("@server/social/post.service").postService;
  let socialPictureService: typeof import("@server/content/social-picture.service").socialPictureService;
  let fx: Awaited<ReturnType<typeof ensureFixtures>>;
  const stamp = `spp-${Date.now().toString(36)}`;
  const assets: string[] = [];
  const products: string[] = [];

  async function asset(orgId: string, ready = true) {
    const n = assets.length;
    const row = await prisma.mediaAsset.create({
      data: {
        orgId,
        kind: "IMAGE",
        ref: `https://media.test/${stamp}/${n}.webp`,
        objectKey: `media/${stamp}/${n}.webp`,
        source: "UPLOAD",
        state: ready ? "READY" : "PENDING",
      },
      select: { id: true, ref: true },
    });
    assets.push(row.id);
    return row;
  }

  async function aProduct(orgId: string, gallery: Array<{ id: string; ref: string }>) {
    const row = await prisma.product.create({
      data: {
        slug: `${stamp}-${products.length}`,
        name: `${stamp} piece ${products.length}`,
        description: "Created by tests/integration/social-picture-presets.test.ts",
        price: 10_000,
        categoryId: fx.categoryId,
        orgId,
        thumbnail: "/brand/bhendi-bazaar.png",
        media: { create: gallery.map((image, position) => ({ kind: "IMAGE" as const, ref: image.ref, assetId: image.id, position })) },
      },
      select: { id: true },
    });
    products.push(row.id);
    return row.id;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ postService } = await import("@server/social/post.service"));
    ({ socialPictureService } = await import("@server/content/social-picture.service"));
    fx = await ensureFixtures();
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

  it("offers two products' main photos in the post's order, portrait for an Instagram post (spec A1)", async () => {
    const pending = await asset(fx.orgId, false);
    const abaya = await asset(fx.orgId);
    const abayaBack = await asset(fx.orgId);
    const bag = await asset(fx.orgId);
    // The first gallery picture is still uploading: the first ready one is the main photo.
    const first = await aProduct(fx.orgId, [pending, abaya, abayaBack]);
    const second = await aProduct(fx.orgId, [bag]);
    const bare = await aProduct(fx.orgId, []);
    const post = await postService.createDraft(fx.orgId, fx.userId, {
      caption: `${stamp} festive`,
      mediaIds: [],
      productIds: [second, bare, first],
      destinations: ["IG_STORY", "IG_FEED"],
    });
    await expect(socialPictureService.presets(fx.orgId, post.id)).resolves.toEqual({ aspect: "4:5", referenceRefs: [bag.ref, abaya.ref] });
  });

  it("never offers a photo from another shop's library, and is tall for a Status alone", async () => {
    const theirs = await asset(fx.otherOrgId);
    const product = await aProduct(fx.orgId, [theirs]);
    const post = await postService.createDraft(fx.orgId, fx.userId, {
      caption: `${stamp} status`,
      mediaIds: [],
      productIds: [product],
      destinations: ["WA_STATUS"],
    });
    await expect(socialPictureService.presets(fx.orgId, post.id)).resolves.toEqual({ aspect: "9:16", referenceRefs: [] });
  });

  it("is not found for another shop asking about this post", async () => {
    const post = await postService.createDraft(fx.orgId, fx.userId, { caption: `${stamp} mine`, mediaIds: [], productIds: [], destinations: [] });
    await expect(socialPictureService.presets(fx.otherOrgId, post.id)).rejects.toMatchObject({ status: 404 });
  });
});
