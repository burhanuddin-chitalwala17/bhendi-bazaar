/**
 * The write path's refusals (image-slots spec R7, trd D7): a picture outside the owner's library,
 * a frame outside the picture or off the shape. The field already prevents these; this is the
 * server deciding again, because the payload is untrusted whoever sends it (Invariant 4).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findReadyImageByRef = vi.fn();
vi.mock("@server/catalog/media-asset.repository", () => ({
  mediaAssetRepository: { findReadyImageByRef: (...a: unknown[]) => findReadyImageByRef(...a) },
}));

const { resolveImageSlot } = await import("@server/catalog/image-slot-write");
const { IMAGE_SLOT } = await import("@server/catalog/image-slots");

const URL = "https://cdn.bhendi-bazaar.com/eid.webp";
const asset = { id: "asset-1", ref: URL, width: 1600, height: 660 };
const input = (desktop: object | null, phone: object | null = null) => ({
  desktop: desktop as never,
  phone: phone as never,
  phoneFocus: { x: 0.7, y: 0.4 },
});

beforeEach(() => {
  findReadyImageByRef.mockReset();
  findReadyImageByRef.mockResolvedValue(asset);
});

describe("resolveImageSlot", () => {
  it("looks the picture up in the owner's library only", async () => {
    await resolveImageSlot(IMAGE_SLOT.ORG_BANNER, "org-1", input({ url: URL, fit: "crop", crop: null, fill: null }), null);
    expect(findReadyImageByRef).toHaveBeenCalledWith("org-1", URL);
  });

  it("refuses a picture that is not in the owner's library", async () => {
    findReadyImageByRef.mockResolvedValue(null);
    await expect(
      resolveImageSlot(IMAGE_SLOT.ORG_BANNER, "org-1", input({ url: URL, fit: "crop", crop: null, fill: null }), null),
    ).rejects.toThrow(/your own library/);
  });

  it("keeps an unchanged picture saved before the media library, framed as it always rendered", async () => {
    findReadyImageByRef.mockResolvedValue(null);
    const columns = await resolveImageSlot(
      IMAGE_SLOT.HOME_BANNER,
      null,
      input({ url: URL, fit: "crop", crop: { x: 0, y: 0, width: 0.5, height: 0.5 }, fill: null }),
      { imageUrl: URL, imageAssetId: null },
    );
    expect(columns.imageUrl).toBe(URL);
    expect(columns.imageFraming).toMatchObject({ desktop: { crop: null, position: { x: 0.5, y: 0.5 } } });
  });

  it("refuses a frame outside the picture", async () => {
    const crop = { x: 0.1, y: 0, width: 0.95, height: 0.9 };
    await expect(
      resolveImageSlot(IMAGE_SLOT.HOME_BANNER, null, input({ url: URL, fit: "crop", crop, fill: null }), null),
    ).rejects.toThrow(/outside/);
  });

  it("refuses a frame off the slot's shape", async () => {
    const crop = { x: 0, y: 0, width: 0.4, height: 1 };
    await expect(
      resolveImageSlot(IMAGE_SLOT.HOME_BANNER, null, input({ url: URL, fit: "crop", crop, fill: null }), null),
    ).rejects.toThrow(/shape/);
  });

  it("stores the frame in the stored picture's pixels, with the position that shows it", async () => {
    const crop = { x: 0, y: 20 / 660, width: 1, height: 640 / 660 };
    const columns = await resolveImageSlot(IMAGE_SLOT.HOME_BANNER, null, input({ url: URL, fit: "crop", crop, fill: null }), null);
    expect(columns).toMatchObject({ imageUrl: URL, imageAssetId: "asset-1", phoneImageUrl: null, phoneImageAssetId: null });
    expect(columns.imageFraming).toMatchObject({
      desktop: { crop: { x: 0, y: 20, width: 1600, height: 640 }, sourceWidth: 1600, sourceHeight: 660, position: { x: 0.5, y: 1 } },
      phone: null,
      phoneFocus: { x: 0.7, y: 0.4 },
    });
  });

  it("drops a fill sent with a crop, and a crop sent with Fit it in", async () => {
    const columns = await resolveImageSlot(
      IMAGE_SLOT.HOME_BANNER,
      null,
      input({ url: URL, fit: "contain", crop: { x: 0, y: 0, width: 1, height: 0.97 }, fill: "#aabbcc" }),
      null,
    );
    expect(columns.imageFraming).toMatchObject({ desktop: { fit: "contain", crop: null, fill: "#aabbcc" } });
  });

  it("writes the phone version to its own columns", async () => {
    findReadyImageByRef.mockResolvedValue({ id: "asset-2", ref: URL, width: 1080, height: 1350 });
    const columns = await resolveImageSlot(IMAGE_SLOT.HOME_BANNER, null, input(null, { url: URL, fit: "crop", crop: null, fill: null }), null);
    expect(columns).toMatchObject({ imageUrl: null, phoneImageUrl: URL, phoneImageAssetId: "asset-2" });
  });
});
