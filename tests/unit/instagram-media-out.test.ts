/**
 * The addresses Instagram fetches for a destination (instagram-publishing TRD D1): a JPEG at the
 * destination's size for a picture, the stored MP4 for a video, and a story fitted on a blurred fill
 * of itself, never cropped off the product.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const catalog = {
  assetDetail: vi.fn(),
  findRendition: vi.fn(),
  describeForRendition: vi.fn(),
  readImageBytes: vi.fn(),
  registerDerivedBytes: vi.fn(),
};
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: catalog }));

const { instagramMedia, IG_MEDIA_MISSING } = await import("@server/channels/instagram/media-out");
const { MEDIA_SURFACES } = await import("@server/catalog/media");
const { NotFoundError } = await import("@server/shared/domain-error");

const image = (id: string) => ({ asset: { id, kind: "IMAGE", state: "READY", renditions: [] } });
const video = (id: string, renditions: Array<{ key: string; url: string }>) => ({
  asset: { id, kind: "VIDEO", state: "READY", renditions },
});

/** A square picture with a green frame, so any crop shows as a missing edge. */
async function framed(edge: number): Promise<Buffer> {
  const inner = await sharp({ create: { width: edge - 40, height: edge - 40, channels: 3, background: "#ff0000" } })
    .png()
    .toBuffer();
  return await sharp({ create: { width: edge, height: edge, channels: 3, background: "#00ff00" } })
    .composite([{ input: inner, left: 20, top: 20 }])
    .webp({ lossless: true })
    .toBuffer();
}

describe("what Instagram fetches", () => {
  beforeEach(() => {
    for (const fn of Object.values(catalog)) fn.mockReset();
    catalog.findRendition.mockResolvedValue(null);
    catalog.describeForRendition.mockResolvedValue({ width: 1200, height: 1200, derivedFromId: null });
    catalog.registerDerivedBytes.mockImplementation(async (input: { sourceAssetId: string; fileSuffix: string }) => ({
      ref: `https://cdn.test/${input.sourceAssetId}-${input.fileSuffix}`,
    }));
  });

  it("sends each picture as a JPEG at the feed's square or portrait size (spec A1)", async () => {
    catalog.assetDetail.mockImplementation(async (_org: string, id: string) => image(id));
    catalog.readImageBytes.mockResolvedValue({ bytes: await framed(1200), objectKey: "k", mimeType: "image/webp" });

    const square = await instagramMedia("org1", "IG_FEED", "SQUARE", ["a1", "a2"]);
    expect(square).toEqual({
      ok: true,
      media: [
        { kind: "IMAGE", url: "https://cdn.test/a1-instagramSquare.jpg" },
        { kind: "IMAGE", url: "https://cdn.test/a2-instagramSquare.jpg" },
      ],
    });
    const portrait = await instagramMedia("org1", "IG_FEED", "PORTRAIT", ["a1"]);
    expect(portrait.ok && portrait.media[0]?.url).toBe("https://cdn.test/a1-instagramPortrait.jpg");

    const sizes = await Promise.all(
      catalog.registerDerivedBytes.mock.calls.map(async ([input]) => {
        const meta = await sharp(input.bytes as Buffer).metadata();
        return { contentType: input.contentType, format: meta.format, width: meta.width, height: meta.height };
      }),
    );
    expect(sizes).toContainEqual({ contentType: "image/jpeg", format: "jpeg", width: 1080, height: 1080 });
    // A 1200px square holds no 1350px portrait: it is cut to 4:5 smaller, never sent off-shape.
    expect(sizes).toContainEqual({ contentType: "image/jpeg", format: "jpeg", width: 960, height: 1200 });
  });

  it("makes a story 1080×1920 with the whole picture fitted on a blurred fill, never cropped (spec A2)", async () => {
    catalog.assetDetail.mockResolvedValue(image("a1"));
    catalog.readImageBytes.mockResolvedValue({ bytes: await framed(1200), objectKey: "k", mimeType: "image/webp" });

    const story = await instagramMedia("org1", "IG_STORY", "SQUARE", ["a1"]);
    expect(story).toEqual({ ok: true, media: [{ kind: "IMAGE", url: "https://cdn.test/a1-instagramStory.jpg" }] });

    const [[input]] = catalog.registerDerivedBytes.mock.calls;
    const { data, info } = await sharp(input.bytes as Buffer).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([MEDIA_SURFACES.instagramStory.width, MEDIA_SURFACES.instagramStory.height]);
    const at = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels;
      return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
    };
    const green = ([r, g, b]: number[]) => g! > 200 && r! < 60 && b! < 60;
    // The frame's left and right edges survive at mid-height: the picture was fitted, not cropped.
    expect(green(at(4, 960))).toBe(true);
    expect(green(at(info.width - 5, 960))).toBe(true);
    // Above the picture is the blurred fill: the picture's own colours, red inside, greener towards the frame, not a flat pad.
    const nearFrame = at(540, 20);
    const inside = at(540, 300);
    expect(inside[0]).toBeGreaterThan(200);
    expect(nearFrame[1]).toBeGreaterThan(inside[1]! + 40);
  });

  it("renders a story from the shop's own crop, since a blurred fill crops nothing", async () => {
    catalog.assetDetail.mockResolvedValue(image("crop"));
    catalog.describeForRendition.mockResolvedValue({ width: 800, height: 800, derivedFromId: "original" });
    catalog.readImageBytes.mockResolvedValue({ bytes: await framed(800), objectKey: "k", mimeType: "image/webp" });
    await instagramMedia("org1", "IG_STORY", "SQUARE", ["crop"]);
    expect(catalog.readImageBytes).toHaveBeenCalledWith("crop");
  });

  it("keeps a small picture at exactly 4:5, which Instagram's narrowest feed shape is", async () => {
    catalog.assetDetail.mockResolvedValue(image("a1"));
    catalog.describeForRendition.mockResolvedValue({ width: 1001, height: 1001, derivedFromId: null });
    catalog.readImageBytes.mockResolvedValue({ bytes: await framed(1001), objectKey: "k", mimeType: "image/webp" });
    await instagramMedia("org1", "IG_FEED", "PORTRAIT", ["a1"]);
    const [[input]] = catalog.registerDerivedBytes.mock.calls;
    const meta = await sharp(input.bytes as Buffer).metadata();
    expect(meta.width! / meta.height!).toBe(0.8);
  });

  it("sends a video as its largest stored MP4", async () => {
    catalog.assetDetail.mockResolvedValue(
      video("v1", [
        { key: "1080p", url: "https://cdn.test/v1-1080p.mp4" },
        { key: "720p", url: "https://cdn.test/v1-720p.mp4" },
      ]),
    );
    expect(await instagramMedia("org1", "IG_FEED", "SQUARE", ["v1"])).toEqual({
      ok: true,
      media: [{ kind: "VIDEO", url: "https://cdn.test/v1-1080p.mp4" }],
    });
    expect(catalog.registerDerivedBytes).not.toHaveBeenCalled();
  });

  it("names a picture or video that is gone or not ready rather than crashing (post-composer D7)", async () => {
    catalog.assetDetail.mockRejectedValueOnce(new NotFoundError("Image not found"));
    expect(await instagramMedia("org1", "IG_FEED", "SQUARE", ["gone"])).toEqual({ ok: false, reason: IG_MEDIA_MISSING });

    catalog.assetDetail.mockResolvedValueOnce({ asset: { id: "r", kind: "IMAGE", state: "RETIRED", renditions: [] } });
    expect(await instagramMedia("org1", "IG_FEED", "SQUARE", ["r"])).toEqual({ ok: false, reason: IG_MEDIA_MISSING });

    catalog.assetDetail.mockResolvedValueOnce(video("v", []));
    expect(await instagramMedia("org1", "IG_FEED", "SQUARE", ["v"])).toEqual({ ok: false, reason: IG_MEDIA_MISSING });
  });
});
