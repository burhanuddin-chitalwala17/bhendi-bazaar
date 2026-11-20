/**
 * The widths every stored photograph is also kept at, and where each copy lives (ADR-0075).
 *
 * Browser-safe: the image loader reads this to pick a file, and the object store reads it to
 * write one, so the two cannot disagree about a name. Rendering lives in object-store.ts.
 */

/** Tile and thumbnail at 3x, gallery on a phone, gallery on a laptop. Above 1200 the original serves. */
export const DELIVERY_WIDTHS = [320, 800, 1200] as const;

export type DeliveryWidth = (typeof DELIVERY_WIDTHS)[number];

/** Raster formats sharp re-encodes faithfully. A GIF or SVG is served as stored. */
const SIZED_EXTENSION = /\.(webp|jpe?g|png|avif)$/i;
const WIDTH_COPY = /\.w\d+\.webp$/i;

/** Whether a stored path is a copy this module made, so it is never sized again. */
export function isWidthCopyPath(pathname: string): boolean {
  return WIDTH_COPY.test(pathname);
}

/** Whether a stored path is a photograph that has width copies beside it. */
export function hasWidthCopies(pathname: string): boolean {
  return SIZED_EXTENSION.test(pathname) && !isWidthCopyPath(pathname);
}

/** `a/b.jpg` at 320 is `a/b.w320.webp`. Works on an encoded path as well as a raw one. */
export function widthPathFor(pathname: string, width: DeliveryWidth): string {
  return pathname.replace(SIZED_EXTENSION, `.w${width}.webp`);
}

/** The smallest copy at least this wide, or null when only the original is wide enough. */
export function deliveryWidthFor(requested: number): DeliveryWidth | null {
  return DELIVERY_WIDTHS.find((width) => width >= requested) ?? null;
}
