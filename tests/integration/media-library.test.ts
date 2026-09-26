/**
 * The asset record against a real schema (media-library R1–R3, trd D1–D3): pending then
 * ready, only ready assets link, references protect a pending row from the sweep, and the
 * backfill brings existing rows under the record once and only once. Owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sharp from "sharp";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("media library (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let repo: typeof import("@server/catalog/media-asset.repository").mediaAssetRepository;
  let backfill: typeof import("@server/catalog/media-backfill").backfillMediaAssets;
  const stamp = Date.now().toString(36);
  const created: string[] = [];
  let orgId: string;
  let categoryId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ mediaAssetRepository: repo } = await import("@server/catalog/media-asset.repository"));
    ({ backfillMediaAssets: backfill } = await import("@server/catalog/media-backfill"));
    const fixtures = await ensureFixtures();
    orgId = fixtures.orgId;
    categoryId = fixtures.categoryId;
  });

  afterAll(async () => {
    await prisma.category.updateMany({ where: { id: categoryId, heroImage: { startsWith: `https://media.test/${stamp}` } }, data: { heroAssetId: null } });
    await prisma.category.deleteMany({ where: { slug: `media-test-${stamp}` } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: created } } });
    await prisma.mediaAsset.deleteMany({ where: { ref: { startsWith: `https://media.test/${stamp}` } } });
  });

  it("moves from pending to ready exactly once, and only ready assets link by ref", async () => {
    const ref = `https://media.test/${stamp}/one.webp`;
    const pending = await repo.createPending({ orgId, uploaderId: null, ref, objectKey: `${stamp}/one.webp`, mimeType: "image/webp", bytes: 10 });
    created.push(pending.id);
    expect(await repo.idsByRefs([ref])).toEqual(new Map());
    expect(await repo.confirm(pending.id, { width: 20, height: 10, bytes: 10, mimeType: "image/webp" })).toBe(true);
    expect(await repo.confirm(pending.id, { width: 1, height: 1, bytes: 1, mimeType: "x" })).toBe(false);
    expect(await repo.idsByRefs([ref])).toEqual(new Map([[ref, pending.id]]));
    const row = await repo.findById(pending.id);
    expect(row).toMatchObject({ state: "READY", width: 20, height: 10 });
  });

  it("finds the refs something still points at", async () => {
    const heroRef = `https://media.test/${stamp}/hero.webp`;
    const category = await prisma.category.create({
      data: { slug: `media-test-${stamp}`, name: `Media Test ${stamp}`, description: "", heroImage: heroRef },
    });
    const referenced = await repo.referencedRefs([heroRef, `https://media.test/${stamp}/nobody.webp`]);
    expect(referenced).toEqual(new Set([heroRef]));
    expect(category.heroAssetId).toBeNull();
  });

  it("backfills an existing reference once, with dimensions read from the bytes", async () => {
    const heroRef = `https://media.test/${stamp}/hero.webp`;
    const png = await sharp({ create: { width: 9, height: 4, channels: 3, background: "#000" } }).png().toBuffer();
    const fetchImpl = (async (url: string | URL | Request) =>
      String(url) === heroRef
        ? new Response(new Uint8Array(png), { status: 200, headers: { "content-type": "image/png" } })
        : new Response(null, { status: 404 })) as typeof fetch;

    const dry = await backfill({ write: false, fetchImpl });
    expect(dry.imagesCreated).toBeGreaterThanOrEqual(1);
    const before = await prisma.mediaAsset.count({ where: { ref: heroRef } });
    expect(before).toBe(0);

    const first = await backfill({ write: true, fetchImpl });
    expect(first.imagesCreated).toBeGreaterThanOrEqual(1);
    const asset = await prisma.mediaAsset.findFirst({ where: { ref: heroRef } });
    expect(asset).toMatchObject({ width: 9, height: 4, orgId: null, state: "READY" });
    const category = await prisma.category.findFirst({ where: { slug: `media-test-${stamp}` } });
    expect(category?.heroAssetId).toBe(asset?.id);

    const second = await backfill({ write: true, fetchImpl });
    expect(await prisma.mediaAsset.count({ where: { ref: heroRef } })).toBe(1);
    expect(second.rowsLinked).toBe(0);
  });
});
