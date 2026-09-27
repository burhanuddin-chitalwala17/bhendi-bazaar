// A crop is a derived image with its rectangle recorded (media-library R8a, trd D6a): the presets
// are declared once, the rectangle the widget reports is made whole and kept inside the turned
// source, an unturned full frame is recognised as no crop at all, and the wire shape refuses what
// a later renderer could not cut.
import { describe, expect, it } from "vitest";
import {
  CROP_ASPECTS,
  CROP_ROTATIONS,
  aspectRatioOf,
  isIdentityTransform,
  normaliseTransform,
  rotateBy,
  rotatedBounds,
} from "@/lib/image/crop-transform";
import { cropTransformSchema, presignUploadSchema } from "@/lib/validation/schemas/upload.schema";

describe("aspect presets", () => {
  it("are the three marketplace shapes and free, declared once", () => {
    expect(Object.values(CROP_ASPECTS)).toEqual(["1:1", "4:5", "3:4", "free"]);
  });

  it("resolve to width over height, and free to the picture's own", () => {
    expect(aspectRatioOf(CROP_ASPECTS.SQUARE)).toBe(1);
    expect(aspectRatioOf(CROP_ASPECTS.PORTRAIT)).toBeCloseTo(4 / 5);
    expect(aspectRatioOf(CROP_ASPECTS.TALL)).toBeCloseTo(3 / 4);
    expect(aspectRatioOf(CROP_ASPECTS.FREE)).toBeUndefined();
  });
});

describe("rotation", () => {
  it("is a quarter turn that wraps in both directions", () => {
    expect(CROP_ROTATIONS).toEqual([0, 90, 180, 270]);
    expect(rotateBy(270, 90)).toBe(0);
    expect(rotateBy(0, -90)).toBe(270);
    expect(rotateBy(90, 90)).toBe(180);
  });

  it("swaps the bounds on a quarter turn and keeps them on a half", () => {
    expect(rotatedBounds(4000, 3000, 90)).toEqual({ width: 3000, height: 4000 });
    expect(rotatedBounds(4000, 3000, 270)).toEqual({ width: 3000, height: 4000 });
    expect(rotatedBounds(4000, 3000, 180)).toEqual({ width: 4000, height: 3000 });
  });
});

describe("normaliseTransform", () => {
  it("rounds what the widget reports to whole pixels", () => {
    const { crop } = normaliseTransform({ x: 10.4, y: 20.6, width: 299.5, height: 300.2 }, 0, 2000, 1500);
    expect(crop).toEqual({ x: 10, y: 21, width: 300, height: 300 });
  });

  it("holds a rectangle that drifted past the edge inside the turned source", () => {
    // 4000×3000 turned a quarter is 3000 wide and 4000 tall.
    const { rotation, crop } = normaliseTransform({ x: 2900, y: -5, width: 400, height: 4100 }, 90, 4000, 3000);
    expect(rotation).toBe(90);
    expect(crop).toEqual({ x: 2900, y: 0, width: 100, height: 4000 });
  });

  it("never records an empty side, even from nonsense", () => {
    expect(normaliseTransform({ x: 5000, y: 5000, width: 0, height: 0 }, 0, 100, 100).crop).toEqual({
      x: 99,
      y: 99,
      width: 1,
      height: 1,
    });
  });
});

describe("isIdentityTransform", () => {
  it("is the whole picture, unturned", () => {
    expect(isIdentityTransform({ rotation: 0, crop: { x: 0, y: 0, width: 2000, height: 1500 } }, 2000, 1500)).toBe(true);
  });

  it("is not a turn, an offset or a smaller frame", () => {
    expect(isIdentityTransform({ rotation: 90, crop: { x: 0, y: 0, width: 1500, height: 2000 } }, 2000, 1500)).toBe(false);
    expect(isIdentityTransform({ rotation: 0, crop: { x: 1, y: 0, width: 1999, height: 1500 } }, 2000, 1500)).toBe(false);
    expect(isIdentityTransform({ rotation: 0, crop: { x: 0, y: 0, width: 1500, height: 1500 } }, 2000, 1500)).toBe(false);
  });
});

describe("the transform on the wire", () => {
  const good = { rotation: 90, crop: { x: 0, y: 12, width: 800, height: 800 } };

  it("accepts a quarter turn and whole, non-empty pixels", () => {
    expect(cropTransformSchema.parse(good)).toEqual(good);
  });

  it("refuses a turn that is not a quarter, a fraction of a pixel, and an empty side", () => {
    expect(cropTransformSchema.safeParse({ ...good, rotation: 45 }).success).toBe(false);
    expect(cropTransformSchema.safeParse({ ...good, crop: { ...good.crop, x: 0.5 } }).success).toBe(false);
    expect(cropTransformSchema.safeParse({ ...good, crop: { ...good.crop, width: 0 } }).success).toBe(false);
    expect(cropTransformSchema.safeParse({ ...good, crop: { ...good.crop, y: -1 } }).success).toBe(false);
  });

  it("rides the presign request as derivedFrom, and only when the caller sends it", () => {
    const base = { pathname: "products/org/a-crop.webp", contentType: "image/webp", size: 10 };
    expect(presignUploadSchema.parse(base).derivedFrom).toBeUndefined();
    expect(presignUploadSchema.parse({ ...base, derivedFrom: { assetId: "src-1", transform: good } }).derivedFrom).toEqual({
      assetId: "src-1",
      transform: good,
    });
    expect(presignUploadSchema.safeParse({ ...base, derivedFrom: { transform: good } }).success).toBe(false);
    expect(presignUploadSchema.safeParse({ ...base, derivedFrom: { assetId: "src-1" } }).success).toBe(false);
  });
});
