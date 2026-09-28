// A repeat upload is recognised by the bytes, not the file name (docs/specs/media-library/ D11):
// the server and the browser spell the same digest, the presign accepts it or nothing, and an
// org's duplicate is answered with its own asset while another org's identical file is not.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { sha256Hex, SHA256_HEX } from "@server/shared/hash";
import { sha256HexOf } from "@/lib/image/hash";
import { presignUploadSchema } from "@/lib/validation/schemas/upload.schema";

const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("the digest", () => {
  it("is SHA-256 hex on both sides, spelled identically", async () => {
    expect(sha256Hex(Buffer.from("abc"))).toBe(ABC);
    expect(await sha256HexOf(new Blob(["abc"]))).toBe(ABC);
    expect(SHA256_HEX.test(ABC)).toBe(true);
  });
});

describe("presignUploadSchema.contentHash", () => {
  const base = { pathname: "products/org/a.webp", contentType: "image/webp", size: 10 };

  it("is optional, and a hex digest when present", () => {
    expect(presignUploadSchema.parse(base).contentHash).toBeUndefined();
    expect(presignUploadSchema.parse({ ...base, contentHash: ABC }).contentHash).toBe(ABC);
    expect(presignUploadSchema.safeParse({ ...base, contentHash: "abc" }).success).toBe(false);
    expect(presignUploadSchema.safeParse({ ...base, contentHash: ABC.toUpperCase() }).success).toBe(false);
  });
});

const repo = { createPending: vi.fn(), findReadyByHash: vi.fn() };
const store = { presignUpload: vi.fn(), publicUrlFor: (key: string) => `https://img.test/${key}` };
vi.mock("@server/catalog/media-asset.repository", () => ({ mediaAssetRepository: repo }));
vi.mock("@server/catalog/object-store", () => store);

describe("beginUpload with a hash", () => {
  beforeEach(() => vi.resetAllMocks());
  const input = { orgId: "org-1", uploaderId: "u1", pathname: "products/org/a.webp", contentType: "image/webp", size: 10, contentHash: ABC };

  it("answers with the asset that already holds these bytes, and signs nothing", async () => {
    const { mediaAssetService } = await import("@server/catalog/media-asset.service");
    repo.findReadyByHash.mockResolvedValue({ id: "a1", ref: "https://img.test/old.webp", width: 800, height: 600 });
    const result = await mediaAssetService.beginUpload(input);
    expect(result).toEqual({ duplicate: { assetId: "a1", ref: "https://img.test/old.webp", width: 800, height: 600 } });
    expect(repo.findReadyByHash).toHaveBeenCalledWith("org-1", ABC);
    expect(store.presignUpload).not.toHaveBeenCalled();
    expect(repo.createPending).not.toHaveBeenCalled();
  });

  it("otherwise signs as before and records the hash on the pending row", async () => {
    const { mediaAssetService } = await import("@server/catalog/media-asset.service");
    repo.findReadyByHash.mockResolvedValue(null);
    store.presignUpload.mockResolvedValue({ uploadUrl: "https://r2/put", publicUrl: "https://img.test/products/org/a.webp" });
    repo.createPending.mockResolvedValue({ id: "a9", ref: "https://img.test/products/org/a.webp" });
    const result = await mediaAssetService.beginUpload(input);
    expect(result).toMatchObject({ uploadUrl: "https://r2/put", assetId: "a9" });
    expect(repo.createPending).toHaveBeenCalledWith(expect.objectContaining({ contentHash: ABC }));
  });

  it("without a hash it never looks one up", async () => {
    const { mediaAssetService } = await import("@server/catalog/media-asset.service");
    store.presignUpload.mockResolvedValue({ uploadUrl: "u", publicUrl: "p" });
    repo.createPending.mockResolvedValue({ id: "a2", ref: "p" });
    await mediaAssetService.beginUpload({ ...input, contentHash: undefined });
    expect(repo.findReadyByHash).not.toHaveBeenCalled();
    expect(repo.createPending).toHaveBeenCalledWith(expect.objectContaining({ contentHash: null }));
  });
});
