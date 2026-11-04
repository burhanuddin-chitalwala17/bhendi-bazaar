/**
 * How a slot's pictures are framed, as the `imageFraming` column keeps it (image-slots trd D2, D3):
 * parsed on read, never cast (ADR-0051), and turned into what the renderer and the field need.
 */

import { z } from "zod";
import { isRenderableImageUrl } from "@server/catalog/image-paths";
import {
  CENTRE,
  FILL_COLOUR,
  IMAGE_FIT,
  positionOfFrame,
  toFractions,
  type FocusPoint,
  type FractionRect,
  type ImageFit,
} from "@server/catalog/image-slots";

const unit = z.number().min(0).max(1);
const point = z.object({ x: unit, y: unit });
const pixels = z.number().int().min(0);

const storedSide = z.object({
  fit: z.enum([IMAGE_FIT.CROP, IMAGE_FIT.CONTAIN]),
  /** The kept rectangle in the stored picture's pixels; null keeps the whole picture, centred. */
  crop: z.object({ x: pixels, y: pixels, width: pixels, height: pixels }).nullable(),
  /** The picture's size when the frame was chosen; null for a picture saved before framing. */
  sourceWidth: pixels.nullable(),
  sourceHeight: pixels.nullable(),
  fill: z.string().regex(FILL_COLOUR).nullable(),
  /** Server-owned: derived from `crop` on save, read by `object-position`. */
  position: point,
});

export const imageFramingSchema = z.object({
  desktop: storedSide.nullable(),
  phone: storedSide.nullable(),
  /** Where phones centre the desktop picture when there is no phone version (spec R4). */
  phoneFocus: point,
});

export type StoredSideFraming = z.infer<typeof storedSide>;
export type ImageFraming = z.infer<typeof imageFramingSchema>;

/** How every picture saved before this rendered: cover, centred (trd D8). */
export const DEFAULT_SIDE_FRAMING: StoredSideFraming = {
  fit: IMAGE_FIT.CROP,
  crop: null,
  sourceWidth: null,
  sourceHeight: null,
  fill: null,
  position: CENTRE,
};

export const DEFAULT_FRAMING: ImageFraming = { desktop: DEFAULT_SIDE_FRAMING, phone: null, phoneFocus: CENTRE };

/** The column as stored, or the default: a storefront never fails to render over a framing. */
export function readImageFraming(value: unknown): ImageFraming {
  const parsed = imageFramingSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_FRAMING;
}

/** One form factor's picture as the renderer draws it. */
export interface ResponsiveImageSide {
  src: string;
  /** `crop` draws cover, `contain` draws the whole picture on `fill`. */
  fit: ImageFit;
  position: FocusPoint;
  fill: string | null;
}

/** What `ResponsiveImage` takes: both form factors always resolved, so it never branches on a fallback. */
export interface ResponsiveImageDto {
  alt: string;
  phone: ResponsiveImageSide;
  desktop: ResponsiveImageSide;
}

export interface ImageSlotRow {
  imageUrl: string | null;
  phoneImageUrl: string | null;
  imageFraming: unknown;
}

const sideOf = (src: string, framing: StoredSideFraming | null): ResponsiveImageSide => {
  const side = framing ?? DEFAULT_SIDE_FRAMING;
  return { src, fit: side.fit, position: side.position, fill: side.fit === IMAGE_FIT.CONTAIN ? side.fill : null };
};

/**
 * Row to renderer props, or null when there is nothing renderable. Without a phone version phones
 * get the desktop picture as cover around the chosen focus (spec R4); without a desktop one, a wide
 * screen gets the phone picture as it is framed.
 */
export function toResponsiveImage(row: ImageSlotRow, alt: string): ResponsiveImageDto | null {
  const framing = readImageFraming(row.imageFraming);
  const desktopSrc = isRenderableImageUrl(row.imageUrl) ? row.imageUrl : null;
  const phoneSrc = isRenderableImageUrl(row.phoneImageUrl) ? row.phoneImageUrl : null;
  if (!desktopSrc && !phoneSrc) return null;

  const phone = phoneSrc
    ? sideOf(phoneSrc, framing.phone)
    : { src: desktopSrc!, fit: IMAGE_FIT.CROP, position: framing.phoneFocus, fill: null };
  const desktop = desktopSrc ? sideOf(desktopSrc, framing.desktop) : phone;
  return { alt, phone, desktop };
}

/** One form factor as the field holds it: the crop back in fractions, which is what the wire carries. */
export interface ImageSlotSideValue {
  url: string;
  /** The picture's size, when known — the field measures a new upload itself; the wire drops it. */
  width?: number | null;
  height?: number | null;
  fit: ImageFit;
  crop: FractionRect | null;
  fill: string | null;
}

export interface ImageSlotValue {
  desktop: ImageSlotSideValue | null;
  phone: ImageSlotSideValue | null;
  phoneFocus: FocusPoint;
}

const valueOf = (url: string | null, framing: StoredSideFraming | null): ImageSlotSideValue | null => {
  if (!url) return null;
  const side = framing ?? DEFAULT_SIDE_FRAMING;
  const { sourceWidth: w, sourceHeight: h } = side;
  return {
    url,
    width: w,
    height: h,
    fit: side.fit,
    crop: side.crop && w && h ? toFractions(side.crop, w, h) : null,
    fill: side.fill,
  };
};

/** Row to what the editor's field starts from. */
export function toImageSlotValue(row: ImageSlotRow): ImageSlotValue | null {
  if (!row.imageUrl && !row.phoneImageUrl) return null;
  const framing = readImageFraming(row.imageFraming);
  return {
    desktop: valueOf(row.imageUrl, framing.desktop),
    phone: valueOf(row.phoneImageUrl, framing.phone),
    phoneFocus: framing.phoneFocus,
  };
}

const previewSide = (side: ImageSlotSideValue): ResponsiveImageSide => ({
  src: side.url,
  fit: side.fit,
  position: side.fit === IMAGE_FIT.CROP && side.crop ? positionOfFrame(side.crop) : CENTRE,
  fill: side.fit === IMAGE_FIT.CONTAIN ? side.fill : null,
});

/** The field's value drawn as the renderer will draw it once saved (spec R5), with the same fallbacks. */
export function previewOf(value: ImageSlotValue | null): Omit<ResponsiveImageDto, "alt"> | null {
  if (!value || (!value.desktop && !value.phone)) return null;
  const phone = value.phone
    ? previewSide(value.phone)
    : { src: value.desktop!.url, fit: IMAGE_FIT.CROP, position: value.phoneFocus, fill: null };
  return { phone, desktop: value.desktop ? previewSide(value.desktop) : phone };
}
