/**
 * A hosted video enters by the photograph's path with its own limits (video-hosting spec R1, R2,
 * trd D1, D2, D4): the presign takes the video types up to the declared size and names that
 * limit when it refuses, the browser refuses what it can know before a byte moves, a VIDEO row
 * is an extra that is never the cover, and a gallery read maps the asset behind the row into a
 * poster, renditions and a state.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VIDEO_LIMITS, VIDEO_TRANSFORM, describeSizeLimit } from "@server/catalog/video";
import { MAX_IMAGE_BYTES } from "@server/catalog/image-paths";
import { presignUploadSchema } from "@/lib/validation/schemas/upload.schema";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import { toProductMediaDto, type ProductMediaInput, type ProductMediaRow } from "@server/catalog/media";
import { renderableMedia } from "@server/catalog/image-paths";

const direct = vi.fn();
vi.mock("@/lib/image/upload-direct", () => ({ uploadDirect: (...args: unknown[]) => direct(...args) }));

const MB = 1024 * 1024;

describe("presignUploadSchema for a video", () => {
  const base = { pathname: "products/org/clip.mp4" };
  const messages = (input: unknown) =>
    presignUploadSchema.safeParse(input).error?.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" | ") ?? "";

  it("accepts each declared video type at 150 MB, well past the image ceiling", () => {
    for (const contentType of ["video/mp4", "video/quicktime", "video/webm"]) {
      const result = presignUploadSchema.safeParse({ ...base, contentType, size: 150 * MB });
      expect(result.success, contentType).toBe(true);
    }
    expect(150 * MB).toBeGreaterThan(MAX_IMAGE_BYTES);
  });

  it("refuses 300 MB with the size limit named from the one constant", () => {
    const result = presignUploadSchema.safeParse({ ...base, contentType: "video/mp4", size: 300 * MB });
    expect(result.success).toBe(false);
    expect(messages({ ...base, contentType: "video/mp4", size: 300 * MB })).toContain(`size: A video must be ${describeSizeLimit()}`);
    expect(describeSizeLimit()).toBe("at most 200 MB");
    // The boundary itself is allowed; one byte over is not.
    expect(presignUploadSchema.safeParse({ ...base, contentType: "video/mp4", size: VIDEO_LIMITS.maxUploadBytes }).success).toBe(true);
    expect(presignUploadSchema.safeParse({ ...base, contentType: "video/mp4", size: VIDEO_LIMITS.maxUploadBytes + 1 }).success).toBe(false);
  });

  it("still holds a photograph to the image ceiling, with the old message", () => {
    expect(presignUploadSchema.safeParse({ pathname: "products/org/a.webp", contentType: "image/webp", size: MAX_IMAGE_BYTES }).success).toBe(true);
    expect(messages({ pathname: "products/org/a.webp", contentType: "image/webp", size: MAX_IMAGE_BYTES + 1 })).toContain("size: Each image must be 5MB or smaller");
  });

  it("refuses a type that is neither an image nor a video we accept", () => {
    for (const contentType of ["video/x-matroska", "application/octet-stream", "audio/mpeg"]) {
      const result = presignUploadSchema.safeParse({ ...base, contentType, size: 10 });
      expect(result.success, contentType).toBe(false);
    }
  });
});

describe("the browser's video checks", () => {
  beforeEach(() => direct.mockReset());

  it("refuses a file that is not a video, and one past the size limit, each naming the file", async () => {
    const { videoFileProblem } = await import("@/lib/image/upload-video");
    expect(videoFileProblem({ name: "notes.txt", type: "text/plain", size: 10 })).toMatch(/Not a video.*notes\.txt/);
    expect(videoFileProblem({ name: "big.mp4", type: "video/mp4", size: VIDEO_LIMITS.maxUploadBytes + 1 })).toMatch(/big\.mp4.*at most 200 MB/);
    expect(videoFileProblem({ name: "clip.mov", type: "video/quicktime", size: VIDEO_LIMITS.maxUploadBytes })).toBeNull();
  });

  it("sends an accepted video straight to uploadDirect, as picked, at the caller's path", async () => {
    const { uploadVideo } = await import("@/lib/image/upload-video");
    direct.mockResolvedValue({ url: "https://img.test/products/o/clip.mp4", assetId: "v1", reused: false });
    const file = new File(["bytes"], "clip.mp4", { type: "video/mp4" });
    const endpoints = { token: "/t", confirm: "/c" };
    const result = await uploadVideo(file, { endpoints, pathFor: (f) => `products/o/${f.name}` });
    expect(result).toEqual({ url: "https://img.test/products/o/clip.mp4", assetId: "v1", reused: false });
    expect(direct).toHaveBeenCalledWith("products/o/clip.mp4", file, endpoints);
  });

  it("refuses before any request when the file cannot be accepted", async () => {
    const { uploadVideo } = await import("@/lib/image/upload-video");
    const file = new File(["bytes"], "clip.mkv", { type: "video/x-matroska" });
    await expect(uploadVideo(file, { endpoints: { token: "/t" }, pathFor: (f) => f.name })).rejects.toThrow(/Not a video/);
    expect(direct).not.toHaveBeenCalled();
  });
});

describe("a VIDEO row in the gallery rules", () => {
  const A = "https://cdn.example.com/a.jpg";
  const CLIP = "https://cdn.example.com/clip.mp4";
  const base = {
    name: "Cream Rida",
    description: "A lightweight cream rida.",
    price: 1200,
    currency: "INR",
    categoryId: "cat_1",
    orgId: "org_1",
    weight: 0.5,
    stockLocations: [{ orgAddressId: "loc_1", quantity: 5 }],
    lowStockThreshold: 10,
  };
  const image = (ref: string, isThumbnail = false): ProductMediaInput => ({ kind: "IMAGE", ref, isThumbnail });
  const hosted = (overrides: Partial<ProductMediaInput> = {}): ProductMediaInput => ({ kind: "VIDEO", ref: CLIP, isThumbnail: false, ...overrides });
  const errorsOf = (media: ProductMediaInput[]) =>
    productFormSchema.safeParse({ ...base, media }).error?.issues.map((issue) => issue.message).join(" | ") ?? "";

  it("is accepted as an extra beside a photograph cover", () => {
    expect(productFormSchema.safeParse({ ...base, media: [image(A, true), hosted()] }).success).toBe(true);
  });

  it("is refused as the cover — the cover is a photograph (product-video R12)", () => {
    expect(errorsOf([hosted({ isThumbnail: true }), image(A)])).toMatch(/cover must be a photograph/i);
  });

  it("is refused in a slot — a video is always an extra (media-library D4)", () => {
    expect(errorsOf([image(A, true), hosted({ slot: "front" })])).toMatch(/a video is always an extra/i);
  });
});

describe("toProductMediaDto", () => {
  const row = (overrides: Partial<ProductMediaRow> = {}): ProductMediaRow => ({
    id: "m1",
    kind: "VIDEO",
    ref: "https://img.test/products/o/clip.mp4",
    description: null,
    isThumbnail: false,
    slot: null,
    asset: null,
    ...overrides,
  });

  it("carries the video fields empty for a photograph and a YouTube link", () => {
    expect(toProductMediaDto(row({ kind: "IMAGE", ref: "https://img.test/a.webp" }))).toEqual({
      id: "m1", kind: "IMAGE", ref: "https://img.test/a.webp", description: null, isThumbnail: false, slot: null,
      poster: null, durationMs: null, renditions: [], state: null,
    });
    expect(toProductMediaDto(row({ kind: "YOUTUBE", ref: "aqz-KE-bpKQ" })).state).toBeNull();
  });

  it("builds the poster, the renditions largest first, the duration and the state from the asset", () => {
    const dto = toProductMediaDto(
      row({
        asset: {
          state: "READY",
          durationMs: 45_000,
          posterAsset: null,
          derivatives: [
            { ref: "https://img.test/clip-720p.mp4", width: 1280, height: 720, transform: { kind: VIDEO_TRANSFORM.RENDITION, key: "720p" } },
            { ref: "https://img.test/clip-poster.jpg", width: 1920, height: 1080, transform: { kind: VIDEO_TRANSFORM.POSTER } },
            { ref: "https://img.test/clip-1080p.mp4", width: 1920, height: 1080, transform: { kind: VIDEO_TRANSFORM.RENDITION, key: "1080p" } },
            // A crop's transform names no kind, and is not a rendition.
            { ref: "https://img.test/odd.webp", width: 10, height: 10, transform: { rotation: 0, crop: { x: 0, y: 0, width: 10, height: 10 } } },
          ],
        },
      }),
    );
    expect(dto.poster).toBe("https://img.test/clip-poster.jpg");
    expect(dto.durationMs).toBe(45_000);
    expect(dto.renditions).toEqual([
      { key: "1080p", url: "https://img.test/clip-1080p.mp4", width: 1920, height: 1080 },
      { key: "720p", url: "https://img.test/clip-720p.mp4", width: 1280, height: 720 },
    ]);
    expect(dto.state).toBe("ready");
  });

  it("reads processing, failed and — with no link at all — processing", () => {
    const at = (state: ProductMediaRow["asset"] extends infer A ? (A extends { state: infer S } ? S : never) : never) =>
      toProductMediaDto(row({ asset: { state, durationMs: null, derivatives: [], posterAsset: null } })).state;
    expect(at("PROCESSING")).toBe("processing");
    expect(at("PENDING")).toBe("processing");
    expect(at("FAILED")).toBe("failed");
    expect(toProductMediaDto(row({ asset: null }))).toMatchObject({ state: "processing", poster: null, renditions: [] });
  });

  it("survives renderableMedia, which only judges photograph URLs", () => {
    const kept = renderableMedia([toProductMediaDto(row())]);
    expect(kept).toHaveLength(1);
  });
});
