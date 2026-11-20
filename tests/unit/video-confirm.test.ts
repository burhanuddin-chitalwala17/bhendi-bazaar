/**
 * Confirming a video is one transaction (video-hosting trd D2, ADR-0038 D2): the row leaves
 * PENDING for PROCESSING and the transcode is enqueued through the same transaction client, so
 * neither a processing asset without a job nor a job without its asset can exist. A photograph
 * keeps the path it had; a second confirm moves nothing and enqueues nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = {
  findById: vi.fn(),
  confirm: vi.fn(),
  startProcessing: vi.fn(),
};
const store = {
  headObject: vi.fn(),
  getObject: vi.fn(),
  presignUpload: vi.fn(),
  deleteObject: vi.fn(),
  ensureWidthCopies: vi.fn(),
  publicUrlFor: (key: string) => `https://img.test/${key}`,
};
const tx = { marker: "the transaction client" };
const prisma = { $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) };
const enqueue = vi.fn();
const videoTranscodeSpec = { type: "media.transcode" };

vi.mock("@server/catalog/media-asset.repository", () => ({ mediaAssetRepository: repo }));
vi.mock("@server/catalog/object-store", () => store);
vi.mock("@server/shared/prisma", () => ({ prisma }));
vi.mock("@server/shared/jobs", () => ({ enqueue: (...args: unknown[]) => enqueue(...args) }));
vi.mock("@server/catalog/video.job", () => ({ videoTranscodeSpec }));

const { mediaAssetService } = await import("@server/catalog/media-asset.service");

const pendingVideo = {
  id: "v1",
  kind: "VIDEO",
  orgId: "org-1",
  state: "PENDING",
  objectKey: "products/o/clip.mp4",
  ref: "https://img.test/products/o/clip.mp4",
};

beforeEach(() => {
  vi.clearAllMocks();
  store.headObject.mockResolvedValue({ contentLength: 50_000_000, contentType: "video/mp4" });
  repo.startProcessing.mockResolvedValue(true);
  enqueue.mockResolvedValue("job-1");
});

describe("confirmUpload of a video", () => {
  it("moves the row to PROCESSING and enqueues the transcode, both through the one transaction", async () => {
    repo.findById.mockResolvedValue(pendingVideo);
    const result = await mediaAssetService.confirmUpload({ assetId: "v1", orgId: "org-1" });

    expect(result).toEqual({ assetId: "v1", ref: pendingVideo.ref, state: "PROCESSING", alreadyReady: false });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(repo.startProcessing).toHaveBeenCalledWith("v1", { bytes: 50_000_000, mimeType: "video/mp4" }, tx);
    expect(enqueue).toHaveBeenCalledWith(tx, videoTranscodeSpec, { assetId: "v1", orgId: "org-1" });
    // The photograph path is not taken: no dimensions are read and `confirm` is never called.
    expect(repo.confirm).not.toHaveBeenCalled();
    expect(store.getObject).not.toHaveBeenCalled();
  });

  it("enqueues nothing when the state did not move — a second confirm that raced the first", async () => {
    repo.findById.mockResolvedValue(pendingVideo);
    repo.startProcessing.mockResolvedValue(false);
    const result = await mediaAssetService.confirmUpload({ assetId: "v1", orgId: "org-1" });
    expect(result.alreadyReady).toBe(true);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("is a no-op on an asset already processing, without touching the store or the queue", async () => {
    repo.findById.mockResolvedValue({ ...pendingVideo, state: "PROCESSING" });
    const result = await mediaAssetService.confirmUpload({ assetId: "v1", orgId: "org-1" });
    expect(result).toEqual({ assetId: "v1", ref: pendingVideo.ref, state: "PROCESSING", alreadyReady: true });
    expect(store.headObject).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("refuses to confirm a video whose bytes have not landed, before any transaction", async () => {
    repo.findById.mockResolvedValue(pendingVideo);
    store.headObject.mockResolvedValue(null);
    await expect(mediaAssetService.confirmUpload({ assetId: "v1", orgId: "org-1" })).rejects.toThrow(/not reached the store/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("a photograph still confirms straight to READY with no job", async () => {
    repo.findById.mockResolvedValue({ ...pendingVideo, id: "p1", kind: "IMAGE", objectKey: "products/o/a.webp" });
    store.headObject.mockResolvedValue({ contentLength: 1234, contentType: "image/webp" });
    repo.confirm.mockResolvedValue(true);
    const result = await mediaAssetService.confirmUpload({ assetId: "p1", orgId: "org-1", width: 800, height: 600 });
    expect(result).toEqual({ assetId: "p1", ref: pendingVideo.ref, state: "READY", alreadyReady: false });
    expect(repo.confirm).toHaveBeenCalledWith("p1", { width: 800, height: 600, bytes: 1234, mimeType: "image/webp" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("beginUpload of a video", () => {
  it("registers the pending row as a VIDEO for a video content type, and as an IMAGE otherwise", async () => {
    const repoMore = repo as typeof repo & { createPending: ReturnType<typeof vi.fn>; findReadyByHash: ReturnType<typeof vi.fn> };
    repoMore.createPending = vi.fn().mockResolvedValue({ id: "v9", ref: "https://img.test/p/clip.mp4" });
    repoMore.findReadyByHash = vi.fn().mockResolvedValue(null);
    store.presignUpload.mockResolvedValue({ uploadUrl: "https://r2/put", publicUrl: "https://img.test/p/clip.mp4" });

    await mediaAssetService.beginUpload({ orgId: "org-1", uploaderId: "u1", pathname: "p/clip.mp4", contentType: "video/quicktime", size: 10 });
    expect(repoMore.createPending).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "VIDEO", mimeType: "video/quicktime" }));

    await mediaAssetService.beginUpload({ orgId: "org-1", uploaderId: "u1", pathname: "p/a.webp", contentType: "image/webp", size: 10 });
    expect(repoMore.createPending).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "IMAGE" }));
  });
});
