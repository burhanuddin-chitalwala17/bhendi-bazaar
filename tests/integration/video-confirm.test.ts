/**
 * A video's confirm against the real schema and the real queue (video-hosting trd D2, ADR-0038
 * D2): the row moves PENDING → PROCESSING and a `media.transcode` job for it sits in the queue's
 * table, written by the same transaction; a second confirm moves nothing and writes no second
 * job. The store is stubbed — no bucket is reached — and the suite owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";

vi.mock("@server/catalog/object-store", () => ({
  headObject: vi.fn(async () => ({ contentLength: 12_345_678, contentType: "video/mp4" })),
  getObject: vi.fn(),
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  presignUpload: vi.fn(),
  publicUrlFor: (key: string) => `https://media.test/${key}`,
  pathnameFor: (url: string) => url.replace("https://media.test/", ""),
  isOwnObjectUrl: (url: string) => url.startsWith("https://media.test/"),
}));

describe.skipIf(!isDisposableDb)("video confirm enqueues the transcode (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let repo: typeof import("@server/catalog/media-asset.repository").mediaAssetRepository;
  let service: typeof import("@server/catalog/media-asset.service").mediaAssetService;
  const stamp = Date.now().toString(36);
  const created: string[] = [];
  let orgId: string;

  const jobsFor = async (assetId: string) => {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'media.transcode' AND data->'payload'->>'assetId' = $2`,
      JOBS_QUEUE,
      assetId,
    );
    return Number(rows[0].n);
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ mediaAssetRepository: repo } = await import("@server/catalog/media-asset.repository"));
    ({ mediaAssetService: service } = await import("@server/catalog/media-asset.service"));
    ({ orgId } = await ensureFixtures());
  });

  afterAll(async () => {
    for (const id of created) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'assetId' = $2`,
        JOBS_QUEUE,
        id,
      );
    }
    await prisma.mediaAsset.deleteMany({ where: { id: { in: created } } });
  });

  it("moves a pending video to PROCESSING with one media.transcode job beside it, and only once", async () => {
    const objectKey = `${stamp}/clip.mp4`;
    const pending = await repo.createPending({
      orgId,
      uploaderId: null,
      ref: `https://media.test/${objectKey}`,
      objectKey,
      mimeType: "video/mp4",
      bytes: 12_345_678,
      kind: "VIDEO",
    });
    created.push(pending.id);
    expect(await jobsFor(pending.id)).toBe(0);

    const first = await service.confirmUpload({ assetId: pending.id, orgId });
    expect(first).toEqual({ assetId: pending.id, ref: pending.ref, state: "PROCESSING", alreadyReady: false });
    const row = await repo.findById(pending.id);
    expect(row).toMatchObject({ kind: "VIDEO", state: "PROCESSING", bytes: 12_345_678, mimeType: "video/mp4", width: null, durationMs: null });
    expect(await jobsFor(pending.id)).toBe(1);

    const second = await service.confirmUpload({ assetId: pending.id, orgId });
    expect(second.alreadyReady).toBe(true);
    expect(await jobsFor(pending.id)).toBe(1);
  });

  it("links a processing video to a gallery row by URL, as a ready photograph is", async () => {
    const objectKey = `${stamp}/linkable.mp4`;
    const ref = `https://media.test/${objectKey}`;
    const pending = await repo.createPending({ orgId, uploaderId: null, ref, objectKey, mimeType: "video/mp4", bytes: 10, kind: "VIDEO" });
    created.push(pending.id);
    expect(await repo.idsByRefs([ref])).toEqual(new Map());
    await service.confirmUpload({ assetId: pending.id, orgId });
    expect(await repo.idsByRefs([ref])).toEqual(new Map([[ref, pending.id]]));
  });
});
