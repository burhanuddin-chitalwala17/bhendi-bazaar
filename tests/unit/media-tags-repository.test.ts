/**
 * The tag statements themselves (ai-images/media-tags D2): the shop's toggle reaches only its own
 * photographs that are not retired, removes by compare-and-set, and `addTag` touches only the org's
 * images. Prisma is a fake that records each statement's `where`.
 *
 * Mutation-tested 2026-11-21 (ADR-0056): dropping `orgId` from `setTag`'s filter, and from `addTag`'s,
 * each turned this red; restored, green.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mediaAsset = { findFirst: vi.fn(), updateMany: vi.fn() };
vi.mock("@server/shared/prisma", () => ({ prisma: { mediaAsset } }));

const { mediaAssetRepository } = await import("@server/catalog/media-asset.repository");

beforeEach(() => {
  mediaAsset.findFirst.mockReset();
  mediaAsset.updateMany.mockReset().mockResolvedValue({ count: 1 });
});

const MINE = { id: "a1", orgId: "org-1", kind: "IMAGE", state: { not: "RETIRED" } };

describe("the shop's toggle", () => {
  it("reads and writes only the org's own photograph that is not retired", async () => {
    mediaAsset.findFirst.mockResolvedValue({ tags: ["PRODUCT"] });
    await expect(mediaAssetRepository.setTag("org-1", "a1", "REFERENCE", true)).resolves.toBe(true);
    expect(mediaAsset.findFirst).toHaveBeenCalledWith({ where: MINE, select: { tags: true } });
    expect(mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { ...MINE, tags: { equals: ["PRODUCT"] } },
      data: { tags: { set: ["PRODUCT", "REFERENCE"] } },
    });
  });

  it("removes by compare-and-set against what it read", async () => {
    mediaAsset.findFirst.mockResolvedValue({ tags: ["PRODUCT", "REFERENCE"] });
    await mediaAssetRepository.setTag("org-1", "a1", "PRODUCT", false);
    expect(mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { ...MINE, tags: { equals: ["PRODUCT", "REFERENCE"] } },
      data: { tags: { set: ["REFERENCE"] } },
    });
  });

  it("is false for a photograph the org does not have — a video, a retired one, another shop's", async () => {
    mediaAsset.findFirst.mockResolvedValue(null);
    await expect(mediaAssetRepository.setTag("org-2", "a1", "PRODUCT", true)).resolves.toBe(false);
    expect(mediaAsset.updateMany).not.toHaveBeenCalled();
  });

  it("writes nothing when the tag is already as asked", async () => {
    mediaAsset.findFirst.mockResolvedValue({ tags: ["REFERENCE"] });
    await expect(mediaAssetRepository.setTag("org-1", "a1", "REFERENCE", true)).resolves.toBe(true);
    expect(mediaAsset.updateMany).not.toHaveBeenCalled();
  });

  it("reads again when another change landed between its read and its write", async () => {
    mediaAsset.findFirst.mockResolvedValueOnce({ tags: [] }).mockResolvedValueOnce({ tags: ["PRODUCT"] });
    mediaAsset.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    await expect(mediaAssetRepository.setTag("org-1", "a1", "REFERENCE", true)).resolves.toBe(true);
    expect(mediaAsset.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { tags: { set: ["PRODUCT", "REFERENCE"] } } }),
    );
  });
});

describe("tagging a gallery's photographs", () => {
  it("touches only the org's images that lack the tag", async () => {
    await mediaAssetRepository.addTag(["a1", "a2"], "PRODUCT", "org-1");
    expect(mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a1", "a2"] }, orgId: "org-1", kind: "IMAGE", NOT: { tags: { has: "PRODUCT" } } },
      data: { tags: { push: "PRODUCT" } },
    });
  });

  it("asks nothing for an empty gallery", async () => {
    await mediaAssetRepository.addTag([], "PRODUCT", "org-1");
    expect(mediaAsset.updateMany).not.toHaveBeenCalled();
  });
});
