// A gallery row points at its asset from the moment it is written (media-library trd D1, R5a):
// a photograph by URL when a ready asset exists, a video by the org's own reference — created
// on the spot when none exists, since nothing else ever would. Before this, videos were never
// linked, so a video used by two products read as unused in the library.
import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = { idsByRefs: vi.fn(), embedIdsByRefs: vi.fn(), createEmbed: vi.fn() };
vi.mock("@server/catalog/media-asset.repository", () => ({ mediaAssetRepository: repo }));
vi.mock("@server/shared/prisma", () => ({ prisma: {} }));

const { withAssetIds } = await import("@server/catalog/admin.product.repository");

beforeEach(() => vi.resetAllMocks());

describe("withAssetIds", () => {
  it("links photographs by URL and videos by the org's reference, and leaves an unknown photograph unlinked", async () => {
    repo.idsByRefs.mockResolvedValue(new Map([["https://img.test/a.webp", "asset-a"]]));
    repo.embedIdsByRefs.mockResolvedValue(new Map([["vid-1", "embed-1"]]));
    const rows = await withAssetIds(
      [
        { kind: "IMAGE" as const, ref: "https://img.test/a.webp" },
        { kind: "IMAGE" as const, ref: "https://img.test/pending.webp" },
        { kind: "YOUTUBE" as const, ref: "vid-1" },
      ],
      "org-1",
    );
    expect(rows.map((row) => row.assetId)).toEqual(["asset-a", null, "embed-1"]);
    expect(repo.idsByRefs).toHaveBeenCalledWith(["https://img.test/a.webp", "https://img.test/pending.webp"], expect.anything());
    expect(repo.embedIdsByRefs).toHaveBeenCalledWith("org-1", ["vid-1"], expect.anything());
    expect(repo.createEmbed).not.toHaveBeenCalled();
  });

  it("creates the org's video reference when the gallery names a video the library has not seen", async () => {
    repo.idsByRefs.mockResolvedValue(new Map());
    repo.embedIdsByRefs.mockResolvedValue(new Map());
    repo.createEmbed.mockResolvedValue({ id: "embed-new", ref: "vid-9" });
    const rows = await withAssetIds(
      [
        { kind: "YOUTUBE" as const, ref: "vid-9" },
        { kind: "YOUTUBE" as const, ref: "vid-9" },
      ],
      "org-1",
    );
    expect(repo.createEmbed).toHaveBeenCalledTimes(1);
    expect(repo.createEmbed).toHaveBeenCalledWith({ orgId: "org-1", ref: "vid-9" }, expect.anything());
    expect(rows.map((row) => row.assetId)).toEqual(["embed-new", "embed-new"]);
  });
});
