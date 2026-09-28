/**
 * A surface asks for a size and gets one made from the right picture
 * ([renditions](../../docs/specs/media-library/renditions/) R2–R4, D2, D3).
 *
 * Two rules carry the feature. A surface asks once, because the pair of source and surface is
 * what identifies the result. And where the shop's own crop lacks the pixels, the rendition
 * reaches back to the untouched original rather than enlarging what the shop cut — the case
 * R4 exists for is a portrait asked of a square crop.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const catalog = {
  findRendition: vi.fn(),
  describeForRendition: vi.fn(),
  readImageBytes: vi.fn(),
  registerDerivedBytes: vi.fn(),
};
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: catalog }));

const { coversSurface, renditionUrl, sourceForSurface } = await import(
  "@server/content/renditions.service"
);
const { MEDIA_SURFACES } = await import("@server/catalog/media");

/** A real one-pixel-per-cell image, so sharp has something to actually resize. */
async function pixels(width: number, height: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return await sharp({
    create: { width, height, channels: 3, background: "#888" },
  })
    .webp()
    .toBuffer();
}

describe("does this picture hold what the surface wants", () => {
  const square = { width: 1000, height: 1000, fit: "cover", quality: 80 } as const;

  it("says yes when the picture is at least the box on both sides", () => {
    expect(coversSurface({ width: 1000, height: 1000 }, square)).toBe(true);
    expect(coversSurface({ width: 2000, height: 1500 }, square)).toBe(true);
  });

  it("says no when filling the box would mean enlarging it", () => {
    expect(coversSurface({ width: 900, height: 1000 }, square)).toBe(false);
    expect(coversSurface({ width: 1000, height: 400 }, square)).toBe(false);
  });

  it("allows a hundredth of slack, because a cut photograph is never exactly its shape", () => {
    expect(coversSurface({ width: 999, height: 1000 }, square)).toBe(true);
  });

  it("says no when the size is unknown, rather than assuming it fits", () => {
    expect(coversSurface({ width: null, height: 1000 }, square)).toBe(false);
  });
});

describe("which picture a surface renders from", () => {
  beforeEach(() => {
    for (const fn of Object.values(catalog)) fn.mockReset();
  });

  it("uses the shop's own crop when the crop has the pixels", async () => {
    catalog.describeForRendition.mockResolvedValue({ width: 2000, height: 2000, derivedFromId: "original" });
    expect(await sourceForSurface("crop", MEDIA_SURFACES.social)).toBe("crop");
  });

  it("reaches back to the original when the crop is short — a portrait from a square crop", async () => {
    // The crop is square and large enough across, but a tall surface needs height it does not
    // have. Enlarging it would be the stretch R4 forbids.
    catalog.describeForRendition.mockResolvedValue({ width: 1200, height: 1200, derivedFromId: "original" });
    expect(await sourceForSurface("crop", { width: 1200, height: 1600, fit: "cover", quality: 80 })).toBe(
      "original",
    );
  });

  it("stays where it is when there is nothing behind it, short or not", async () => {
    // An upload has no parent. Rendering from itself and losing a little sharpness beats
    // failing to render at all.
    catalog.describeForRendition.mockResolvedValue({ width: 300, height: 300, derivedFromId: null });
    expect(await sourceForSurface("upload", MEDIA_SURFACES.social)).toBe("upload");
  });
});

describe("a surface asks once", () => {
  beforeEach(() => {
    for (const fn of Object.values(catalog)) fn.mockReset();
  });

  it("returns what is already there without rendering again", async () => {
    catalog.findRendition.mockResolvedValue({ id: "r1", ref: "https://img.test/tile.webp", width: 600, height: 600 });

    expect(await renditionUrl("org_1", "a1", "tile")).toBe("https://img.test/tile.webp");
    expect(catalog.readImageBytes).not.toHaveBeenCalled();
    expect(catalog.registerDerivedBytes).not.toHaveBeenCalled();
  });

  it("renders and records against the asset that was asked for, not the one it came from", async () => {
    catalog.findRendition.mockResolvedValue(null);
    // The crop is short, so the pixels come from the original — but the record belongs to the
    // crop, because the crop plus the surface is the pair the next request looks up.
    catalog.describeForRendition.mockResolvedValue({ width: 300, height: 300, derivedFromId: "original" });
    catalog.readImageBytes.mockResolvedValue({ bytes: await pixels(1800, 1800), objectKey: "k", mimeType: "image/webp" });
    catalog.registerDerivedBytes.mockResolvedValue({ id: "r2", ref: "https://img.test/made.webp" });

    const url = await renditionUrl("org_1", "crop", "tile");

    expect(url).toBe("https://img.test/made.webp");
    expect(catalog.readImageBytes).toHaveBeenCalledWith("original");
    expect(catalog.registerDerivedBytes).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAssetId: "crop", transform: { surface: "tile" } }),
    );
  });

  it("renders to the surface's own size and never enlarges to reach it", async () => {
    catalog.findRendition.mockResolvedValue(null);
    catalog.describeForRendition.mockResolvedValue({ width: 4000, height: 4000, derivedFromId: null });
    catalog.readImageBytes.mockResolvedValue({ bytes: await pixels(4000, 4000), objectKey: "k", mimeType: "image/webp" });
    catalog.registerDerivedBytes.mockResolvedValue({ id: "r3", ref: "https://img.test/thumb.webp" });

    await renditionUrl("org_1", "a1", "thumb");

    const sharp = (await import("sharp")).default;
    const written = catalog.registerDerivedBytes.mock.calls[0][0].bytes as Buffer;
    const meta = await sharp(written).metadata();
    expect(meta.width).toBe(MEDIA_SURFACES.thumb.width);
    expect(meta.height).toBe(MEDIA_SURFACES.thumb.height);
    expect(meta.format).toBe("webp");
  });

  it("leaves a small picture small rather than blowing it up to fill the box", async () => {
    catalog.findRendition.mockResolvedValue(null);
    catalog.describeForRendition.mockResolvedValue({ width: 80, height: 80, derivedFromId: null });
    catalog.readImageBytes.mockResolvedValue({ bytes: await pixels(80, 80), objectKey: "k", mimeType: "image/webp" });
    catalog.registerDerivedBytes.mockResolvedValue({ id: "r4", ref: "https://img.test/small.webp" });

    await renditionUrl("org_1", "a1", "thumb");

    const sharp = (await import("sharp")).default;
    const written = catalog.registerDerivedBytes.mock.calls[0][0].bytes as Buffer;
    expect((await sharp(written).metadata()).width).toBe(80);
  });
});
