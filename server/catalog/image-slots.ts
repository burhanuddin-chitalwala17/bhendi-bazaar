/**
 * Every place that shows an uploaded picture, with the shape it needs on a phone and on a desktop
 * (image-slots R1, trd D1), and the arithmetic both the field and the server use on a framing.
 * Pure: no Prisma and no DOM, so the client field imports it and the server validates with it.
 */

export const FORM_FACTOR = { PHONE: "phone", DESKTOP: "desktop" } as const;
export type FormFactor = (typeof FORM_FACTOR)[keyof typeof FORM_FACTOR];

export const IMAGE_FIT = { CROP: "crop", CONTAIN: "contain" } as const;
export type ImageFit = (typeof IMAGE_FIT)[keyof typeof IMAGE_FIT];

export const IMAGE_SLOT = {
  HOME_BANNER: "home-banner",
  ORG_BANNER: "org-banner",
  STOREFRONT_HERO: "storefront-hero",
  STOREFRONT_COLLECTION: "storefront-collection",
} as const;
export type ImageSlotKey = (typeof IMAGE_SLOT)[keyof typeof IMAGE_SLOT];

export interface SlotShape {
  width: number;
  height: number;
  /** Narrower than this looks soft at the size the slot is drawn. */
  minWidth: number;
  /** How the field names the shape: "wide 5:2". */
  label: string;
}

export interface ImageSlotDeclaration {
  desktop: SlotShape;
  phone: SlotShape;
}

/** The storefront's own banner and the home banner are one hero component, so one shape. */
const BANNER: ImageSlotDeclaration = {
  desktop: { width: 1600, height: 640, minWidth: 1600, label: "wide 5:2" },
  phone: { width: 1080, height: 1350, minWidth: 720, label: "tall 4:5" },
};

export const IMAGE_SLOTS: Record<ImageSlotKey, ImageSlotDeclaration> = {
  [IMAGE_SLOT.HOME_BANNER]: BANNER,
  [IMAGE_SLOT.ORG_BANNER]: BANNER,
  // The full-bleed themed hero (`hero.tsx`): 4:5 on a phone, 16:9 from md. The split and banner
  // variants draw the same set in their own boxes, centred on what was kept (trd D3).
  [IMAGE_SLOT.STOREFRONT_HERO]: {
    desktop: { width: 1920, height: 1080, minWidth: 1280, label: "wide 16:9" },
    phone: { width: 1080, height: 1350, minWidth: 720, label: "tall 4:5" },
  },
  [IMAGE_SLOT.STOREFRONT_COLLECTION]: {
    desktop: { width: 1200, height: 1500, minWidth: 600, label: "tall 4:5" },
    phone: { width: 1080, height: 1350, minWidth: 480, label: "tall 4:5" },
  },
};

export const ratioOf = (shape: { width: number; height: number }) => shape.width / shape.height;

/**
 * Within this of the slot's shape a picture is treated as that shape: no choice to make. Also how
 * far a crop may stray, since a frame is whole pixels and its ratio rounds.
 */
export const RATIO_MATCH_TOLERANCE = 0.02;

export function isOffShape(width: number, height: number, shape: { width: number; height: number }): boolean {
  if (width <= 0 || height <= 0) return false;
  return Math.abs(width / height / ratioOf(shape) - 1) > RATIO_MATCH_TOLERANCE;
}

/** A point on the picture, 0–1 from the left and from the top. */
export type FocusPoint = { x: number; y: number };
export const CENTRE: FocusPoint = { x: 0.5, y: 0.5 };

/** A rectangle as fractions of the picture: what the wire carries (trd D4). */
export type FractionRect = { x: number; y: number; width: number; height: number };
/** The same rectangle in the stored picture's pixels: what the column keeps. */
export type PixelRect = FractionRect;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Where `object-position` puts a cover-fitted picture so that this rectangle is what shows (trd D3).
 * With `object-fit: cover` a position of p% aligns the picture's p% with the box's p%, so the left
 * edge of a frame at x lands on the box's left edge when p = x / (1 − width). A frame spanning the
 * whole axis has nowhere to move: the centre.
 */
export function positionOfFrame(frame: FractionRect): FocusPoint {
  const axis = (start: number, size: number) => (size >= 1 ? 0.5 : clamp01(start / (1 - size)));
  return { x: axis(frame.x, frame.width), y: axis(frame.y, frame.height) };
}

export function toFractions(rect: PixelRect, sourceWidth: number, sourceHeight: number): FractionRect {
  return {
    x: rect.x / sourceWidth,
    y: rect.y / sourceHeight,
    width: rect.width / sourceWidth,
    height: rect.height / sourceHeight,
  };
}

export function toPixels(frame: FractionRect, sourceWidth: number, sourceHeight: number): PixelRect {
  return {
    x: Math.round(frame.x * sourceWidth),
    y: Math.round(frame.y * sourceHeight),
    width: Math.round(frame.width * sourceWidth),
    height: Math.round(frame.height * sourceHeight),
  };
}

/** Why a stored frame cannot be used on this picture for this shape, or null when it can (R7). */
export function frameProblem(
  rect: PixelRect,
  sourceWidth: number,
  sourceHeight: number,
  shape: { width: number; height: number },
): string | null {
  const { x, y, width, height } = rect;
  if (width < 1 || height < 1 || x < 0 || y < 0 || x + width > sourceWidth || y + height > sourceHeight) {
    return "That frame falls outside the picture. Choose it again.";
  }
  if (isOffShape(width, height, shape)) return "That frame is not the slot's shape. Choose it again.";
  return null;
}

/**
 * The largest frame of this shape the picture holds, centred: what Keep it exact starts from, and
 * what the frame can only slide along (it never zooms, trd D3).
 */
export function largestFrame(sourceWidth: number, sourceHeight: number, shape: { width: number; height: number }): FractionRect {
  const ratio = ratioOf(shape);
  const own = sourceWidth / sourceHeight;
  if (own > ratio) {
    const width = ratio / own;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = own / ratio;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

/** What a picture of this size needs said before it is used in this shape, or null. */
export function describeShapeProblem(width: number, height: number, shape: SlotShape): string | null {
  if (width <= 0 || height <= 0) return "That file could not be read as a picture.";
  if (width < shape.minWidth) {
    return `This picture is ${width}px wide. Bring one at least ${shape.minWidth}px wide, or it will look soft.`;
  }
  return null;
}

export const FILL_COLOUR = /^#[0-9a-f]{6}$/i;
