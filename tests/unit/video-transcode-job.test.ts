/**
 * The transcode job against a mocked encoder (video-hosting trd D3, ADR-0038 D4): a source no
 * longer processing is left alone, a clip past a limit is failed with the limit named and its
 * bytes removed, a good clip becomes two renditions and a poster recorded as DERIVED assets and
 * the source is finished, a re-run adds nothing already made, and any other failure is recorded
 * on the asset with the bytes kept. The encoder itself is covered by video-transcode.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DomainError } from "@server/shared/domain-error";
import { VIDEO_TRANSFORM } from "@server/catalog/video";

const repo = {
  findById: vi.fn(),
  findDerivatives: vi.fn(),
  createReady: vi.fn(),
  finishProcessing: vi.fn(),
  failProcessing: vi.fn(),
};
const store = {
  getObject: vi.fn(),
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  publicUrlFor: (key: string) => `https://img.test/${key}`,
};
const encoder = {
  probeVideo: vi.fn(),
  assertWithinLimits: vi.fn(),
  transcodeVideo: vi.fn(),
  withTranscodeLock: vi.fn((work: () => Promise<unknown>) => work()),
};
vi.mock("@server/catalog/media-asset.repository", () => ({ mediaAssetRepository: repo }));
vi.mock("@server/catalog/object-store", () => store);
vi.mock("@server/catalog/video-transcode", () => encoder);

const { videoTranscodeJob } = await import("@server/catalog/video.jobs");

const processing = {
  id: "v1",
  kind: "VIDEO",
  state: "PROCESSING",
  orgId: "org-1",
  uploaderId: "u1",
  objectKey: "products/o/clip/clip-123.mov",
  ref: "https://img.test/products/o/clip/clip-123.mov",
};
const probe = { durationMs: 45_000, width: 1920, height: 1080 };

const run = () => videoTranscodeJob.handler({ jobId: "job-1", payload: { assetId: "v1", orgId: "org-1" } });

/** Writes the files a real encode would, into the directory the job hands it. */
const fakeEncode = async (_source: string, outDir: string) => {
  const file = async (name: string, width: number, height: number, mimeType: string) => {
    const path = join(outDir, name);
    await writeFile(path, `bytes of ${name}`);
    return { key: name.replace(/\..*$/, ""), path, width, height, bytes: 10, mimeType };
  };
  return {
    renditions: [await file("1080p.mp4", 1920, 1080, "video/mp4"), await file("720p.mp4", 1280, 720, "video/mp4")],
    poster: await file("poster.jpg", 1920, 1080, "image/jpeg"),
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  repo.findById.mockResolvedValue(processing);
  repo.findDerivatives.mockResolvedValue([]);
  repo.createReady.mockImplementation(async (input: { ref: string }) => ({ id: `d-${input.ref}`, ref: input.ref }));
  repo.finishProcessing.mockResolvedValue(true);
  repo.failProcessing.mockResolvedValue(true);
  store.getObject.mockResolvedValue(Buffer.from("source bytes"));
  store.putObject.mockImplementation(async (pathname: string) => `https://img.test/${pathname}`);
  encoder.probeVideo.mockResolvedValue(probe);
  encoder.assertWithinLimits.mockImplementation(() => undefined);
  encoder.transcodeVideo.mockImplementation(fakeEncode);
});

describe("media.transcode", () => {
  it("runs under the transcode lock and is grouped by org", () => {
    expect(videoTranscodeJob.type).toBe("media.transcode");
    expect(videoTranscodeJob.group?.({ assetId: "v1", orgId: "org-1" })).toBe("org-1");
    expect(videoTranscodeJob.group?.({ assetId: "v1", orgId: null })).toBeUndefined();
  });

  it("leaves a source that is no longer processing alone — a redelivered job does nothing", async () => {
    repo.findById.mockResolvedValue({ ...processing, state: "READY" });
    await run();
    expect(encoder.withTranscodeLock).toHaveBeenCalledTimes(1);
    expect(store.getObject).not.toHaveBeenCalled();
    expect(encoder.probeVideo).not.toHaveBeenCalled();
    expect(repo.finishProcessing).not.toHaveBeenCalled();
    expect(repo.failProcessing).not.toHaveBeenCalled();
  });

  it("fails a clip past the limit with the limit named, deletes its bytes, and never encodes", async () => {
    encoder.assertWithinLimits.mockImplementation(() => {
      throw new DomainError("This video is 100 seconds long; a product video is at most 90 seconds");
    });
    await run();
    expect(store.deleteObject).toHaveBeenCalledWith("https://img.test/products/o/clip/clip-123.mov");
    expect(repo.failProcessing).toHaveBeenCalledWith(
      "v1",
      "This video is 100 seconds long; a product video is at most 90 seconds",
      { dropObject: true },
    );
    expect(encoder.transcodeVideo).not.toHaveBeenCalled();
    expect(repo.finishProcessing).not.toHaveBeenCalled();
  });

  it("treats a file no decoder reads the same way", async () => {
    encoder.probeVideo.mockRejectedValue(new DomainError("This file has no video we can read"));
    await run();
    expect(repo.failProcessing).toHaveBeenCalledWith("v1", "This file has no video we can read", { dropObject: true });
    expect(store.deleteObject).toHaveBeenCalledTimes(1);
  });

  it("stores two renditions and a poster beside the source as DERIVED assets, then finishes the source", async () => {
    await run();

    expect(store.putObject.mock.calls.map((call) => [call[0], call[2]])).toEqual([
      ["products/o/clip/clip-123-1080p.mp4", "video/mp4"],
      ["products/o/clip/clip-123-720p.mp4", "video/mp4"],
      ["products/o/clip/clip-123-poster.jpg", "image/jpeg"],
    ]);
    expect(repo.createReady).toHaveBeenCalledTimes(3);
    expect(repo.createReady).toHaveBeenNthCalledWith(1, expect.objectContaining({
      kind: "VIDEO",
      source: "DERIVED",
      derivedFromId: "v1",
      transform: { kind: VIDEO_TRANSFORM.RENDITION, key: "1080p" },
      ref: "https://img.test/products/o/clip/clip-123-1080p.mp4",
      objectKey: "products/o/clip/clip-123-1080p.mp4",
      mimeType: "video/mp4",
      width: 1920,
      height: 1080,
      durationMs: 45_000,
      orgId: "org-1",
      uploaderId: "u1",
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(repo.createReady).toHaveBeenNthCalledWith(2, expect.objectContaining({ transform: { kind: VIDEO_TRANSFORM.RENDITION, key: "720p" }, width: 1280, height: 720 }));
    expect(repo.createReady).toHaveBeenNthCalledWith(3, expect.objectContaining({
      kind: "IMAGE",
      source: "DERIVED",
      derivedFromId: "v1",
      transform: { kind: VIDEO_TRANSFORM.POSTER },
      mimeType: "image/jpeg",
      durationMs: null,
    }));
    // The bytes recorded are the bytes stored, not what the encoder claimed.
    expect(repo.createReady.mock.calls[0][0].bytes).toBe("bytes of 1080p.mp4".length);
    expect(repo.finishProcessing).toHaveBeenCalledWith("v1", { width: 1920, height: 1080, durationMs: 45_000 });
    expect(repo.failProcessing).not.toHaveBeenCalled();
    expect(store.deleteObject).not.toHaveBeenCalled();
  });

  it("adds nothing on a re-run when every output already exists, and still finishes the source", async () => {
    repo.findDerivatives.mockResolvedValue([
      { id: "d1", kind: "VIDEO", ref: "x", transform: { kind: VIDEO_TRANSFORM.RENDITION, key: "1080p" } },
      { id: "d2", kind: "VIDEO", ref: "y", transform: { kind: VIDEO_TRANSFORM.RENDITION, key: "720p" } },
      { id: "d3", kind: "IMAGE", ref: "z", transform: { kind: VIDEO_TRANSFORM.POSTER } },
    ]);
    await run();
    expect(store.putObject).not.toHaveBeenCalled();
    expect(repo.createReady).not.toHaveBeenCalled();
    expect(repo.finishProcessing).toHaveBeenCalledWith("v1", { width: 1920, height: 1080, durationMs: 45_000 });
  });

  it("makes only the missing output when a previous run got half way", async () => {
    repo.findDerivatives.mockResolvedValue([
      { id: "d1", kind: "VIDEO", ref: "x", transform: { kind: VIDEO_TRANSFORM.RENDITION, key: "1080p" } },
    ]);
    await run();
    expect(store.putObject.mock.calls.map((call) => call[0])).toEqual([
      "products/o/clip/clip-123-720p.mp4",
      "products/o/clip/clip-123-poster.jpg",
    ]);
  });

  it("lets any other failure reach the queue — retried, then parked — and writes nothing on the asset", async () => {
    store.putObject.mockRejectedValueOnce(new Error("store refused the PUT"));
    await expect(run()).rejects.toThrow("store refused the PUT");
    expect(repo.failProcessing).not.toHaveBeenCalled();
    expect(repo.finishProcessing).not.toHaveBeenCalled();
  });
});
