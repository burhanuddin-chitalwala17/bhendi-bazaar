/**
 * The poster an org member chooses for a hosted video (video-hosting spec R8): it wins over the
 * frame the worker cut on both reads, the service refuses a photograph that is not this org's
 * ready photograph as "not found", null goes back to the frame, and the body accepts an id or
 * null and nothing else.
 */
import type { MediaTag } from "@server/catalog/media-library.types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { VIDEO_TRANSFORM } from "@server/catalog/video";

const repo = {
  findForOrg: vi.fn(),
  setPoster: vi.fn(),
};
vi.mock("@server/catalog/media-asset.repository", () => ({ mediaAssetRepository: repo }));
vi.mock("@server/catalog/object-store", () => ({}));

const { mediaAssetService } = await import("@server/catalog/media-asset.service");
const { toProductMediaDto } = await import("@server/catalog/media");
const { toMediaAssetDto } = await import("@server/catalog/media-library.types");
const { videoPosterSchema } = await import("@/lib/validation/schemas/media-library.schema");

const FRAME = "https://img.test/clip-poster.jpg";
const CHOSEN = "https://img.test/chosen.webp";
const derivatives = [
  { ref: FRAME, width: 1920, height: 1080, transform: { kind: VIDEO_TRANSFORM.POSTER } },
  { ref: "https://img.test/clip-720p.mp4", width: 1280, height: 720, transform: { kind: VIDEO_TRANSFORM.RENDITION, key: "720p" } },
  { ref: "https://img.test/clip-1080p.mp4", width: 1920, height: 1080, transform: { kind: VIDEO_TRANSFORM.RENDITION, key: "1080p" } },
];

const counts = { productMedia: 0, categoryHeroes: 0, profileLogos: 0, profileHeroes: 0, storefrontSlots: 0, orgBanners: 0, banners: 0, orgBannerPhones: 0, storefrontSlotPhones: 0, bannerPhones: 0, derivatives: 0, postersFor: 0 };

const libraryRow = (overrides: Record<string, unknown> = {}) => ({
  id: "v1",
  kind: "VIDEO" as const,
  ref: "https://img.test/clip.mp4",
  width: 1920,
  height: 1080,
  bytes: 1_000_000,
  mimeType: "video/mp4",
  source: "UPLOAD" as const,
  state: "READY" as const,
  durationMs: 45_000,
  failureReason: null,
  createdAt: new Date("2026-09-27T08:00:00Z"),
  orgId: "org_1",
  retiredAt: null,
  retiredBy: null,
  retiredReason: null,
  tags: [] as MediaTag[],
  derivatives,
  posterAsset: null,
  _count: counts,
  ...overrides,
});

const photo = (overrides: Record<string, unknown> = {}) =>
  libraryRow({ id: "p1", kind: "IMAGE", ref: CHOSEN, mimeType: "image/webp", durationMs: null, derivatives: [], ...overrides });

beforeEach(() => vi.resetAllMocks());

describe("the poster a product read shows", () => {
  const row = (posterAsset: { ref: string } | null, withFrame = true) =>
    toProductMediaDto({
      id: "m1",
      kind: "VIDEO",
      ref: "https://img.test/clip.mp4",
      description: null,
      isThumbnail: false,
      slot: null,
      asset: { state: "READY", durationMs: 45_000, posterAsset, derivatives: withFrame ? derivatives : derivatives.slice(1) },
    });

  it("is the chosen photograph when there is one, over the frame the worker cut", () => {
    expect(row({ ref: CHOSEN }).poster).toBe(CHOSEN);
  });

  it("is the worker's frame when nothing was chosen", () => {
    expect(row(null).poster).toBe(FRAME);
  });

  it("is null when there is neither, and the renditions are unaffected either way", () => {
    expect(row(null, false).poster).toBeNull();
    expect(row({ ref: CHOSEN }, false)).toMatchObject({ poster: CHOSEN, renditions: [expect.objectContaining({ key: "1080p" }), expect.objectContaining({ key: "720p" })] });
  });
});

describe("the poster and renditions the library shows", () => {
  it("resolves the same way as the product read, and carries the renditions largest first", () => {
    expect(toMediaAssetDto(libraryRow()).poster).toBe(FRAME);
    const dto = toMediaAssetDto(libraryRow({ posterAsset: { ref: CHOSEN } }));
    expect(dto.poster).toBe(CHOSEN);
    expect(dto.renditions.map((rendition) => rendition.key)).toEqual(["1080p", "720p"]);
  });

  it("a photograph has no poster and no renditions, whatever derivatives it has", () => {
    const crop = { ref: "https://img.test/crop.webp", width: 10, height: 10, transform: { rotation: 0, crop: { x: 0, y: 0, width: 10, height: 10 } } };
    expect(toMediaAssetDto(photo({ derivatives: [crop] }))).toMatchObject({ poster: null, renditions: [] });
  });
});

describe("replacePoster", () => {
  it("links this org's ready photograph and hands back the video as it now reads", async () => {
    repo.findForOrg.mockResolvedValueOnce(photo()).mockResolvedValueOnce(libraryRow({ posterAsset: { ref: CHOSEN } }));
    repo.setPoster.mockResolvedValue(true);
    const dto = await mediaAssetService.replacePoster("org-1", "v1", "p1");
    expect(repo.findForOrg).toHaveBeenNthCalledWith(1, "org-1", "p1");
    expect(repo.setPoster).toHaveBeenCalledWith("org-1", "v1", "p1");
    expect(dto.poster).toBe(CHOSEN);
  });

  it("refuses another org's photograph as not found, before writing anything", async () => {
    repo.findForOrg.mockResolvedValue(null);
    await expect(mediaAssetService.replacePoster("org-1", "v1", "p-theirs")).rejects.toMatchObject({ name: "NotFoundError", message: "Photo not found" });
    expect(repo.setPoster).not.toHaveBeenCalled();
  });

  it("refuses a photograph that is not ready, and a video posing as one", async () => {
    repo.findForOrg.mockResolvedValueOnce(photo({ state: "PENDING" }));
    await expect(mediaAssetService.replacePoster("org-1", "v1", "p1")).rejects.toMatchObject({ name: "NotFoundError" });
    repo.findForOrg.mockResolvedValueOnce(libraryRow({ id: "v2" }));
    await expect(mediaAssetService.replacePoster("org-1", "v1", "v2")).rejects.toMatchObject({ name: "NotFoundError" });
    expect(repo.setPoster).not.toHaveBeenCalled();
  });

  it("null goes back to the worker's frame without looking any photograph up", async () => {
    repo.setPoster.mockResolvedValue(true);
    repo.findForOrg.mockResolvedValueOnce(libraryRow());
    const dto = await mediaAssetService.replacePoster("org-1", "v1", null);
    expect(repo.setPoster).toHaveBeenCalledWith("org-1", "v1", null);
    expect(repo.findForOrg).toHaveBeenCalledTimes(1);
    expect(dto.poster).toBe(FRAME);
  });

  it("is not found when the conditional write moves nothing — another org's video, or not a video", async () => {
    repo.setPoster.mockResolvedValue(false);
    await expect(mediaAssetService.replacePoster("org-2", "v1", null)).rejects.toMatchObject({ name: "NotFoundError", message: "Video not found" });
  });
});

describe("videoPosterSchema", () => {
  it("takes an id or null", () => {
    expect(videoPosterSchema.parse({ posterAssetId: "p1" })).toEqual({ posterAssetId: "p1" });
    expect(videoPosterSchema.parse({ posterAssetId: " p1 " })).toEqual({ posterAssetId: "p1" });
    expect(videoPosterSchema.parse({ posterAssetId: null })).toEqual({ posterAssetId: null });
  });

  it("takes nothing else — a missing field is not null, and a number or a blank is not an id", () => {
    for (const body of [{}, { posterAssetId: undefined }, { posterAssetId: 5 }, { posterAssetId: "" }, { posterAssetId: "x".repeat(65) }, { posterAssetId: {} }]) {
      expect(() => videoPosterSchema.parse(body), JSON.stringify(body)).toThrow(ZodError);
    }
  });
});
