/**
 * The narrow seams the catalog opens for enhancement (image-enhancement trd D1, ADR-0033 D3): a
 * photograph found by id or by URL within the org, its bytes for a worker, a loose object put and
 * deleted with no record, and bytes adopted as a READY DERIVED image beside their source — measured,
 * hashed, carrying the transform that made them, and answered with the existing asset when the org
 * already holds those bytes. The repository and the object store are mocked; sharp reads real pixels.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { NotFoundError } from "@server/shared/domain-error";

const repo = {
  findById: vi.fn(),
  findReadyImage: vi.fn(),
  findReadyByHash: vi.fn(),
  createReady: vi.fn(),
};
const store = {
  getObject: vi.fn(),
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  headObject: vi.fn(),
  presignUpload: vi.fn(),
  publicUrlFor: (key: string) => `https://img.test/${key}`,
};
vi.mock("@server/catalog/media-asset.repository", () => ({ mediaAssetRepository: repo }));
vi.mock("@server/catalog/object-store", () => store);
vi.mock("@server/shared/prisma", () => ({ prisma: {} }));
vi.mock("@server/shared/jobs", () => ({ enqueue: vi.fn() }));
vi.mock("@server/catalog/video.job", () => ({ videoTranscodeSpec: { type: "media.transcode" } }));

const { mediaAssetService } = await import("@server/catalog/media-asset.service");

const source = {
  id: "a1",
  orgId: "org-1",
  uploaderId: "u1",
  kind: "IMAGE",
  state: "READY",
  objectKey: "products/o/front/a-123.webp",
  ref: "https://img.test/products/o/front/a-123.webp",
  mimeType: "image/webp",
};
const transform = { tool: "LIGHT", preset: null, provider: "sharp", enhancementId: "e1" };
const adopt = () =>
  mediaAssetService.registerDerivedObject({
    orgId: "org-1",
    uploaderId: "u1",
    sourceAssetId: "a1",
    fromKey: "proposals/e1.webp",
    fileSuffix: "light-e1.webp",
    contentType: "image/webp",
    transform,
  });

let proposal: Buffer;

beforeEach(async () => {
  vi.clearAllMocks();
  proposal = await sharp({ create: { width: 4, height: 3, channels: 3, background: { r: 200, g: 200, b: 200 } } }).webp().toBuffer();
  repo.findById.mockResolvedValue(source);
  repo.findReadyByHash.mockResolvedValue(null);
  repo.createReady.mockImplementation(async (input: { ref: string }) => ({ id: "d1", ref: input.ref }));
  store.getObject.mockResolvedValue(proposal);
  store.putObject.mockImplementation(async (pathname: string) => `https://img.test/${pathname}`);
});

describe("findReadyImage and readImageBytes", () => {
  it("asks the repository within the org, by id or by URL", async () => {
    repo.findReadyImage.mockResolvedValue({ id: "a1", ref: source.ref, width: 1600, height: 1200 });
    await expect(mediaAssetService.findReadyImage("org-1", { ref: source.ref })).resolves.toMatchObject({ id: "a1" });
    expect(repo.findReadyImage).toHaveBeenCalledWith("org-1", { ref: source.ref });
  });

  it("hands a worker the stored bytes of a ready photograph, and nothing for anything else", async () => {
    await expect(mediaAssetService.readImageBytes("a1")).resolves.toEqual({ bytes: proposal, mimeType: "image/webp" });
    expect(store.getObject).toHaveBeenCalledWith(source.objectKey);

    repo.findById.mockResolvedValue({ ...source, kind: "VIDEO" });
    await expect(mediaAssetService.readImageBytes("a1")).rejects.toBeInstanceOf(NotFoundError);
    repo.findById.mockResolvedValue({ ...source, objectKey: null });
    await expect(mediaAssetService.readImageBytes("a1")).rejects.toBeInstanceOf(NotFoundError);
    repo.findById.mockResolvedValue(null);
    await expect(mediaAssetService.readImageBytes("a1")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("loose objects", () => {
  it("puts and deletes by key, creating no record, and spells the public URL once", async () => {
    await expect(mediaAssetService.putLooseObject("proposals/e1.webp", proposal, "image/webp")).resolves.toBe(
      "https://img.test/proposals/e1.webp",
    );
    expect(store.putObject).toHaveBeenCalledWith("proposals/e1.webp", proposal, "image/webp");
    await mediaAssetService.deleteLooseObject("proposals/e1.webp");
    expect(store.deleteObject).toHaveBeenCalledWith("https://img.test/proposals/e1.webp");
    expect(mediaAssetService.publicUrlOf("proposals/e1.webp")).toBe("https://img.test/proposals/e1.webp");
    expect(repo.createReady).not.toHaveBeenCalled();
  });
});

describe("registerDerivedObject", () => {
  it("copies the proposal beside its source and records a READY DERIVED image with its making, size and hash", async () => {
    await expect(adopt()).resolves.toEqual({ id: "d1", ref: "https://img.test/products/o/front/a-123-light-e1.webp" });

    expect(store.getObject).toHaveBeenCalledWith("proposals/e1.webp");
    expect(store.putObject).toHaveBeenCalledWith("products/o/front/a-123-light-e1.webp", proposal, "image/webp");
    expect(repo.createReady).toHaveBeenCalledWith({
      orgId: "org-1",
      uploaderId: "u1",
      ref: "https://img.test/products/o/front/a-123-light-e1.webp",
      objectKey: "products/o/front/a-123-light-e1.webp",
      mimeType: "image/webp",
      bytes: proposal.byteLength,
      width: 4,
      height: 3,
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      source: "DERIVED",
      derivedFromId: "a1",
      transform,
    });
  });

  it("answers the asset the org already holds for those bytes, storing nothing twice", async () => {
    repo.findReadyByHash.mockResolvedValue({ id: "d0", ref: "https://img.test/earlier.webp", width: 4, height: 3 });
    await expect(adopt()).resolves.toEqual({ id: "d0", ref: "https://img.test/earlier.webp" });
    expect(store.putObject).not.toHaveBeenCalled();
    expect(repo.createReady).not.toHaveBeenCalled();
  });

  it("refuses a source that is another org's, not a photograph, or not ours to copy beside", async () => {
    repo.findById.mockResolvedValue({ ...source, orgId: "org-2" });
    await expect(adopt()).rejects.toBeInstanceOf(NotFoundError);
    repo.findById.mockResolvedValue({ ...source, kind: "VIDEO" });
    await expect(adopt()).rejects.toBeInstanceOf(NotFoundError);
    repo.findById.mockResolvedValue({ ...source, objectKey: null });
    await expect(adopt()).rejects.toBeInstanceOf(NotFoundError);
    expect(store.getObject).not.toHaveBeenCalled();
  });
});
