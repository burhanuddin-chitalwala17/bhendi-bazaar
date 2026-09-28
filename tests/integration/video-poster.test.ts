/**
 * A video's chosen poster against a real schema (video-hosting spec R8): the link is written by one
 * conditional statement scoped to the org, the library read resolves the chosen photograph over the
 * worker's frame, another org's photograph is refused before anything is written, null goes back to
 * the frame, and a photograph standing in for a video counts as in use. Owns its fixtures.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MediaAssetKind, MediaAssetSource } from "@prisma/client";
import { VIDEO_TRANSFORM } from "@server/catalog/video";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("video poster (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let repo: typeof import("@server/catalog/media-asset.repository").mediaAssetRepository;
  let service: typeof import("@server/catalog/media-asset.service").mediaAssetService;
  const stamp = `poster-${Date.now().toString(36)}`;
  const prefix = `https://media.test/${stamp}/`;
  let orgId: string;
  let otherOrgId: string;
  let videoId: string;
  let frameId: string;
  let photoId: string;
  let theirPhotoId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ mediaAssetRepository: repo } = await import("@server/catalog/media-asset.repository"));
    ({ mediaAssetService: service } = await import("@server/catalog/media-asset.service"));
    ({ orgId, otherOrgId } = await ensureFixtures());
    const ready = { uploaderId: null, objectKey: null, bytes: 10, width: 1920, height: 1080 };
    videoId = (
      await repo.createReady({ ...ready, orgId, kind: MediaAssetKind.VIDEO, ref: `${prefix}clip.mp4`, mimeType: "video/mp4", durationMs: 45_000 })
    ).id;
    frameId = (
      await repo.createReady({
        ...ready,
        orgId,
        ref: `${prefix}clip-poster.jpg`,
        mimeType: "image/jpeg",
        source: MediaAssetSource.DERIVED,
        derivedFromId: videoId,
        transform: { kind: VIDEO_TRANSFORM.POSTER },
      })
    ).id;
    photoId = (await repo.createReady({ ...ready, orgId, ref: `${prefix}chosen.webp`, mimeType: "image/webp" })).id;
    theirPhotoId = (await repo.createReady({ ...ready, orgId: otherOrgId, ref: `${prefix}theirs.webp`, mimeType: "image/webp" })).id;
  });

  afterAll(async () => {
    await prisma.mediaAsset.updateMany({ where: { ref: { startsWith: prefix } }, data: { posterAssetId: null } });
    await prisma.mediaAsset.deleteMany({ where: { id: frameId } });
    await prisma.mediaAsset.deleteMany({ where: { ref: { startsWith: prefix } } });
  });

  it("reads the worker's frame until a photograph is chosen, then the photograph", async () => {
    expect((await service.assetDetail(orgId, videoId)).asset.poster).toBe(`${prefix}clip-poster.jpg`);

    const chosen = await service.replacePoster(orgId, videoId, photoId);
    expect(chosen.poster).toBe(`${prefix}chosen.webp`);
    expect((await repo.findForOrg(orgId, videoId))?.posterAsset?.ref).toBe(`${prefix}chosen.webp`);
    expect(frameId).toBeTruthy();
  });

  it("counts the chosen photograph as in use, so it cannot be retired from under the video", async () => {
    const photo = await service.assetDetail(orgId, photoId);
    expect(photo.asset.uses).toBe(1);
    expect(photo.uses).toEqual([{ kind: "video-poster", id: videoId, label: "Video poster", slot: null }]);
    await expect(service.retire(orgId, photoId)).rejects.toMatchObject({ name: "ConflictError", message: expect.stringContaining("1 video poster") });
  });

  it("refuses another org's photograph, and leaves the chosen one in place", async () => {
    await expect(service.replacePoster(orgId, videoId, theirPhotoId)).rejects.toMatchObject({ name: "NotFoundError" });
    expect((await service.assetDetail(orgId, videoId)).asset.poster).toBe(`${prefix}chosen.webp`);
  });

  it("another org cannot move this video's poster at all", async () => {
    expect(await repo.setPoster(otherOrgId, videoId, null)).toBe(false);
    await expect(service.replacePoster(otherOrgId, videoId, null)).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("null goes back to the worker's frame, and the photograph is free again", async () => {
    const reset = await service.replacePoster(orgId, videoId, null);
    expect(reset.poster).toBe(`${prefix}clip-poster.jpg`);
    expect((await service.assetDetail(orgId, photoId)).asset.uses).toBe(0);
  });

  it("a photograph is not a video: the write moves nothing", async () => {
    expect(await repo.setPoster(orgId, photoId, null)).toBe(false);
  });
});
