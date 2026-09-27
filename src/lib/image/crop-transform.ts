/**
 * The rotate-and-crop a derived image records (media-library R8a, trd D6a): arithmetic shared by
 * the sheet that produces it, the canvas that renders it and the schema that accepts it. No DOM
 * and no Zod here — the wire shape lives in upload.schema.ts and imports these.
 */

/** The aspect presets offered at upload, declared once. Free is the picture's own shape. */
export const CROP_ASPECTS = { SQUARE: "1:1", PORTRAIT: "4:5", TALL: "3:4", FREE: "free" } as const;
export type CropAspect = (typeof CROP_ASPECTS)[keyof typeof CROP_ASPECTS];

export const CROP_ROTATIONS = [0, 90, 180, 270] as const;
export type CropRotation = (typeof CROP_ROTATIONS)[number];

/** A rectangle in whole pixels of the source *after* it is turned — the space the widget reports in. */
export type CropRect = { x: number; y: number; width: number; height: number };
export type CropTransform = { rotation: CropRotation; crop: CropRect };

/** Width over height for a preset; undefined for free, which a caller reads as the picture's own ratio. */
export function aspectRatioOf(aspect: CropAspect): number | undefined {
  if (aspect === CROP_ASPECTS.FREE) return undefined;
  const [width, height] = aspect.split(":").map(Number);
  return width / height;
}

/** The box a width×height picture occupies once turned by a quarter-turn multiple. */
export function rotatedBounds(width: number, height: number, rotation: CropRotation): { width: number; height: number } {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

export function rotateBy(rotation: CropRotation, delta: 90 | -90): CropRotation {
  return ((((rotation + delta) % 360) + 360) % 360) as CropRotation;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * What the widget reports, made storable: whole pixels, held inside the turned source, never an
 * empty side. A pinch can leave the rectangle a fraction past the edge, and a fraction of a pixel
 * is not something a later renderer can cut.
 */
export function normaliseTransform(
  area: CropRect,
  rotation: CropRotation,
  sourceWidth: number,
  sourceHeight: number,
): CropTransform {
  const bounds = rotatedBounds(Math.max(1, Math.round(sourceWidth)), Math.max(1, Math.round(sourceHeight)), rotation);
  const x = clamp(Math.round(area.x), 0, bounds.width - 1);
  const y = clamp(Math.round(area.y), 0, bounds.height - 1);
  const width = clamp(Math.round(area.width), 1, bounds.width - x);
  const height = clamp(Math.round(area.height), 1, bounds.height - y);
  return { rotation, crop: { x, y, width, height } };
}

/** Unturned and covering the whole source: the "crop" is the original, so there is nothing to derive. */
export function isIdentityTransform(transform: CropTransform, sourceWidth: number, sourceHeight: number): boolean {
  const { rotation, crop } = transform;
  return (
    rotation === 0 &&
    crop.x === 0 &&
    crop.y === 0 &&
    crop.width === Math.round(sourceWidth) &&
    crop.height === Math.round(sourceHeight)
  );
}
