/**
 * Library tags (ai-images/media-tags R1–R7; trd D1–D6): the closed set and its mirror, the filter's
 * parse, the shop's toggle scoped to its own org, and the DTO carrying what the row holds.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaTag as PrismaMediaTag } from "@prisma/client";
import { MEDIA_TAG, MEDIA_TAGS, toMediaAssetDto, type MediaAssetRow } from "@server/catalog/media-library.types";
import { mediaLibraryFilterSchema, mediaTagSchema } from "@/lib/validation/schemas/media-library.schema";

const repo = { setTag: vi.fn(), findForOrg: vi.fn() };
vi.mock("@server/catalog/media-asset.repository", () => ({ mediaAssetRepository: repo }));
vi.mock("@server/catalog/object-store", () => ({}));

const { mediaAssetService } = await import("@server/catalog/media-asset.service");

beforeEach(() => {
  repo.setTag.mockReset();
  repo.findForOrg.mockReset();
});

describe("the closed set", () => {
  it("mirrors the schema's enum exactly, Product and Reference (Q21)", () => {
    expect([...MEDIA_TAGS].sort()).toEqual(Object.values(PrismaMediaTag).sort());
    expect(MEDIA_TAGS).toEqual(["PRODUCT", "REFERENCE"]);
  });
});

describe("the filter", () => {
  it("takes a tag from the set, and a blank is any tag", () => {
    expect(mediaLibraryFilterSchema.parse({ tag: "REFERENCE" }).tag).toBe("REFERENCE");
    expect(mediaLibraryFilterSchema.parse({ tag: "" }).tag).toBeUndefined();
  });

  it("refuses a tag nobody declared — a shop never types one (R1)", () => {
    expect(() => mediaLibraryFilterSchema.parse({ tag: "mood" })).toThrow(/Invalid option/);
    expect(() => mediaTagSchema.parse({ tag: "mood", on: true })).toThrow(/Invalid option/);
    expect(() => mediaTagSchema.parse({ tag: "REFERENCE" })).toThrow(/expected boolean/);
  });
});

describe("the shop's toggle (R6)", () => {
  it("answers the image as it now reads", async () => {
    repo.setTag.mockResolvedValue(true);
    repo.findForOrg.mockResolvedValue(row({ tags: [MEDIA_TAG.PRODUCT, MEDIA_TAG.REFERENCE] }));
    const dto = await mediaAssetService.setTag("org-1", "a1", MEDIA_TAG.REFERENCE, true);
    expect(repo.setTag).toHaveBeenCalledWith("org-1", "a1", "REFERENCE", true);
    expect(dto.tags).toEqual(["PRODUCT", "REFERENCE"]);
  });

  it("is not found for another org's image, without saying it exists", async () => {
    repo.setTag.mockResolvedValue(false);
    await expect(mediaAssetService.setTag("org-2", "a1", MEDIA_TAG.REFERENCE, false)).rejects.toThrow("Image not found");
    expect(repo.findForOrg).not.toHaveBeenCalled();
  });
});

function row(over: Partial<MediaAssetRow> = {}): MediaAssetRow {
  return {
    id: "a1",
    kind: "IMAGE",
    ref: "https://img.test/a.webp",
    width: 800,
    height: 800,
    bytes: 1000,
    mimeType: "image/webp",
    source: "UPLOAD",
    state: "READY",
    durationMs: null,
    failureReason: null,
    createdAt: new Date("2026-11-21"),
    orgId: "org-1",
    retiredAt: null,
    retiredBy: null,
    retiredReason: null,
    tags: [],
    derivatives: [],
    posterAsset: null,
    _count: {} as MediaAssetRow["_count"],
    ...over,
  } as MediaAssetRow;
}

describe("the DTO", () => {
  it("carries the row's tags", () => {
    expect(toMediaAssetDto({ ...row({ tags: [MEDIA_TAG.REFERENCE] }), _count: row()._count }).tags).toEqual(["REFERENCE"]);
  });
});
