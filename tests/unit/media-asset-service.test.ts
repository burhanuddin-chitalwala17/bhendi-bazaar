/**
 * An upload is registered before it is signed and made true after it lands (media-library
 * R1, trd D2): the store is asked what it holds, the dimensions are read from the object when
 * the browser could not send them, another organisation's upload cannot be confirmed, and the
 * sweep never pulls an image out from under a row that references it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

const repo = {
  createPending: vi.fn(),
  findById: vi.fn(),
  confirm: vi.fn(),
  createReady: vi.fn(),
  findStalePending: vi.fn(),
  referencedRefs: vi.fn(),
  deletePending: vi.fn(),
};
const store = {
  presignUpload: vi.fn(),
  headObject: vi.fn(),
  getObject: vi.fn(),
  deleteObject: vi.fn(),
  publicUrlFor: (key: string) => `https://img.test/${key}`,
};
vi.mock("@server/catalog/media-asset.repository", () => ({ mediaAssetRepository: repo }));
vi.mock("@server/catalog/object-store", () => store);

const { mediaAssetService, PENDING_UPLOAD_TTL_MS } = await import("@server/catalog/media-asset.service");

const pending = { id: "a1", orgId: "org-1", state: "PENDING", objectKey: "products/x/a.webp", ref: "https://img.test/products/x/a.webp" };

beforeEach(() => {
  vi.clearAllMocks();
  repo.confirm.mockResolvedValue(true);
  store.headObject.mockResolvedValue({ contentLength: 1234, contentType: "image/webp" });
});

describe("beginUpload", () => {
  it("registers the asset as pending and returns its id with the signed URL", async () => {
    store.presignUpload.mockResolvedValue({ uploadUrl: "https://r2/put", publicUrl: "https://img.test/p/a.webp" });
    repo.createPending.mockResolvedValue({ id: "a9", ref: "https://img.test/p/a.webp" });
    const result = await mediaAssetService.beginUpload({ orgId: "org-1", uploaderId: "u1", pathname: "p/a.webp", contentType: "image/webp", size: 10 });
    expect(result).toEqual({ uploadUrl: "https://r2/put", publicUrl: "https://img.test/p/a.webp", assetId: "a9" });
    expect(repo.createPending).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-1", uploaderId: "u1", objectKey: "p/a.webp", bytes: 10 }));
  });
});

describe("confirmUpload", () => {
  it("records what the store holds and the dimensions the browser sent", async () => {
    repo.findById.mockResolvedValue(pending);
    const result = await mediaAssetService.confirmUpload({ assetId: "a1", orgId: "org-1", width: 800, height: 600 });
    expect(result).toEqual({ assetId: "a1", ref: pending.ref, alreadyReady: false });
    expect(repo.confirm).toHaveBeenCalledWith("a1", { width: 800, height: 600, bytes: 1234, mimeType: "image/webp" });
    expect(store.getObject).not.toHaveBeenCalled();
  });

  it("reads the dimensions from the object when the browser could not", async () => {
    repo.findById.mockResolvedValue(pending);
    store.getObject.mockResolvedValue(await sharp({ create: { width: 7, height: 5, channels: 3, background: "#fff" } }).png().toBuffer());
    await mediaAssetService.confirmUpload({ assetId: "a1", orgId: "org-1" });
    expect(repo.confirm).toHaveBeenCalledWith("a1", expect.objectContaining({ width: 7, height: 5 }));
  });

  it("refuses another organisation's upload", async () => {
    repo.findById.mockResolvedValue(pending);
    await expect(mediaAssetService.confirmUpload({ assetId: "a1", orgId: "org-2", width: 1, height: 1 })).rejects.toThrow(/someone else/);
    expect(repo.confirm).not.toHaveBeenCalled();
  });

  it("refuses to confirm before the bytes have landed", async () => {
    repo.findById.mockResolvedValue(pending);
    store.headObject.mockResolvedValue(null);
    await expect(mediaAssetService.confirmUpload({ assetId: "a1", orgId: "org-1", width: 1, height: 1 })).rejects.toThrow(/not reached the store/);
  });

  it("is a no-op on an asset that is already ready", async () => {
    repo.findById.mockResolvedValue({ ...pending, state: "READY" });
    const result = await mediaAssetService.confirmUpload({ assetId: "a1", orgId: "org-1", width: 1, height: 1 });
    expect(result.alreadyReady).toBe(true);
    expect(store.headObject).not.toHaveBeenCalled();
  });
});

describe("sweepPendingUploads", () => {
  it("removes stale pending rows and their objects, but keeps any a row still references", async () => {
    const now = new Date("2026-09-26T12:00:00Z");
    repo.findStalePending.mockResolvedValue([
      { id: "p1", ref: "https://img.test/a.webp", objectKey: "a.webp" },
      { id: "p2", ref: "https://img.test/b.webp", objectKey: "b.webp" },
    ]);
    repo.referencedRefs.mockResolvedValue(new Set(["https://img.test/b.webp"]));
    repo.deletePending.mockResolvedValue(1);
    const result = await mediaAssetService.sweepPendingUploads(now);
    expect(repo.findStalePending).toHaveBeenCalledWith(new Date(now.getTime() - PENDING_UPLOAD_TTL_MS));
    expect(store.deleteObject).toHaveBeenCalledTimes(1);
    expect(store.deleteObject).toHaveBeenCalledWith("https://img.test/a.webp");
    expect(repo.deletePending).toHaveBeenCalledWith(["p1"]);
    expect(result).toEqual({ removed: 1, kept: 1 });
  });
});
