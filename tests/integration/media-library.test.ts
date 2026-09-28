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

    // These fixtures are `https://media.test/…` on purpose, so nothing here belongs to the
    // configured store and the store check would refuse a write. That refusal is the point of
    // the check; saying so here is what the flag is for, and a run without it is covered by
    // `tests/unit/media-backfill-store-check.test.ts`.
    const allowForeign = true;

    const dry = await backfill({ write: false, fetchImpl, allowForeign });
    expect(dry.imagesCreated).toBeGreaterThanOrEqual(1);
    const before = await prisma.mediaAsset.count({ where: { ref: heroRef } });
    expect(before).toBe(0);

    const first = await backfill({ write: true, fetchImpl, allowForeign });
    expect(first.imagesCreated).toBeGreaterThanOrEqual(1);
    const asset = await prisma.mediaAsset.findFirst({ where: { ref: heroRef } });
    expect(asset).toMatchObject({ width: 9, height: 4, orgId: null, state: "READY" });
    const category = await prisma.category.findFirst({ where: { slug: `media-test-${stamp}` } });
    expect(category?.heroAssetId).toBe(asset?.id);

    const second = await backfill({ write: true, fetchImpl, allowForeign });
    expect(await prisma.mediaAsset.count({ where: { ref: heroRef } })).toBe(1);
    expect(second.rowsLinked).toBe(0);
  });
});

describe.skipIf(!isDisposableDb)("media library — reads and retirement (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let repo: typeof import("@server/catalog/media-asset.repository").mediaAssetRepository;
  let service: typeof import("@server/catalog/media-asset.service").mediaAssetService;
  const stamp = `lib-${Date.now().toString(36)}`;
  const prefix = `https://media.test/${stamp}/`;
  const filters = (over: Partial<import("@/lib/validation/schemas/media-library.schema").MediaLibraryFilters> = {}) =>
    ({ usage: "all" as const, retired: false, page: 1, ...over });
  let orgId: string;
  let assetId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ mediaAssetRepository: repo } = await import("@server/catalog/media-asset.repository"));
    ({ mediaAssetService: service } = await import("@server/catalog/media-asset.service"));
    orgId = (await ensureFixtures()).orgId;
    assetId = (
      await repo.createReady({
        orgId,
        uploaderId: null,
        ref: `${prefix}banner.webp`,
        objectKey: null,
        mimeType: "image/webp",
        bytes: 10,
        width: 1200,
        height: 400,
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.orgBanner.deleteMany({ where: { title: stamp } });
    await prisma.mediaAsset.deleteMany({ where: { ref: { startsWith: prefix } } });
  });

  it("lists with a use count derived from what points at the asset, and filters used from unused", async () => {
    await prisma.orgBanner.create({
      data: { orgId, title: stamp, imageUrl: `${prefix}banner.webp`, imageAssetId: assetId },
    });
    const used = await service.listLibrary(orgId, filters({ usage: "used" }));
    expect(used.assets.find((asset) => asset.id === assetId)).toMatchObject({ uses: 1, width: 1200 });
    const unused = await service.listLibrary(orgId, filters({ usage: "unused" }));
    expect(unused.assets.map((asset) => asset.id)).not.toContain(assetId);
    const detail = await service.assetDetail(orgId, assetId);
    expect(detail.uses).toEqual([{ kind: "storefront-banner", id: expect.any(String), label: stamp, slot: null }]);
  });

  it("refuses to retire an image something uses, naming it, and retires it once nothing does", async () => {
    await expect(service.retire(orgId, assetId)).rejects.toMatchObject({
      name: "ConflictError",
      message: expect.stringContaining("1 storefront banner"),
    });
    expect((await repo.findForOrg(orgId, assetId))?.state).toBe("READY");

    await prisma.orgBanner.deleteMany({ where: { title: stamp } });
    const retired = await service.retire(orgId, assetId);
    expect(retired.state).toBe("RETIRED");
    expect(retired.retiredAt).not.toBeNull();

    const live = await service.listLibrary(orgId, filters());
    expect(live.assets.map((asset) => asset.id)).not.toContain(assetId);
    const shelved = await service.listLibrary(orgId, filters({ retired: true }));
    expect(shelved.assets.map((asset) => asset.id)).toContain(assetId);
  });

  it("another org's id is not found, so a retire across orgs cannot even be refused", async () => {
    const { otherOrgId } = await ensureFixtures();
    await expect(service.retire(otherOrgId, assetId)).rejects.toMatchObject({ name: "NotFoundError" });
  });
});

describe.skipIf(!isDisposableDb)("media library — the same bytes within an org (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let repo: typeof import("@server/catalog/media-asset.repository").mediaAssetRepository;
  const stamp = `hash-${Date.now().toString(36)}`;
  const prefix = `https://media.test/${stamp}/`;
  const hash = "b".repeat(64);
  let orgId: string;
  let otherOrgId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ mediaAssetRepository: repo } = await import("@server/catalog/media-asset.repository"));
    ({ orgId, otherOrgId } = await ensureFixtures());
  });

  afterAll(async () => {
    await prisma.mediaAsset.deleteMany({ where: { ref: { startsWith: prefix } } });
  });

  it("finds this org's ready asset by hash, never another org's, never a retired one", async () => {
    const ready = { uploaderId: null, objectKey: null, mimeType: "image/webp", bytes: 3, width: 1, height: 1, contentHash: hash };
    const mine = await repo.createReady({ ...ready, orgId, ref: `${prefix}mine.webp` });
    await repo.createReady({ ...ready, orgId: otherOrgId, ref: `${prefix}theirs.webp` });
    expect(await repo.findReadyByHash(orgId, hash)).toMatchObject({ id: mine.id, ref: `${prefix}mine.webp` });
    expect((await repo.findReadyByHash(otherOrgId, hash))?.ref).toBe(`${prefix}theirs.webp`);
    expect(await repo.findReadyByHash(orgId, "c".repeat(64))).toBeNull();

    await prisma.mediaAsset.update({ where: { id: mine.id }, data: { state: "RETIRED", retiredAt: new Date() } });
    expect(await repo.findReadyByHash(orgId, hash)).toBeNull();
  });

  it("the backfill's hash pass fills what was recorded before the column existed", async () => {
    const created = await repo.createReady({
      orgId, uploaderId: null, ref: `${prefix}unhashed.png`, objectKey: null, mimeType: "image/png", bytes: 3, width: 1, height: 1,
    });
    const pending = await repo.listWithoutHash(500);
    expect(pending.map((row) => row.id)).toContain(created.id);
    await repo.setHash(created.id, hash);
    expect((await repo.listWithoutHash(500)).map((row) => row.id)).not.toContain(created.id);
  });
});
