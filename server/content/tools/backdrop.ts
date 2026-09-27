import sharp from "sharp";
import { MAX_IMAGE_EDGE } from "@server/catalog/media";
import type { Placement } from "@server/content/tools/pixel-identity";

/**
 * Every number the two backdrop tools are made of, declared once (CLAUDE.md, Development
 * Principles). A margin or a gradient stop written at a call site turns "make the backdrop
 * warmer" into a hunt through three files.
 */

/** The clear border around the product on a square backdrop, as a fraction of the square's edge. */
export const PRODUCT_MARGIN_RATIO = 0.08;
/** What is left for the product itself once both margins are taken out. */
export const CONTENT_RATIO = 1 - 2 * PRODUCT_MARGIN_RATIO;

/** The breathing room left around a bare cut-out, as a fraction of its longest edge, floored in pixels. */
export const CUTOUT_MARGIN_RATIO = 0.01;
export const CUTOUT_MIN_MARGIN_PX = 2;

/** Below this the pixel was blended with the background and is not part of the product. */
export const PRODUCT_ALPHA_THRESHOLD = 8;

/** The studio's neutral: a warm off-white at the top falling to a light stone at the bottom. */
export const STUDIO_GRADIENT_TOP = { r: 246, g: 244, b: 240 } as const;
export const STUDIO_GRADIENT_BOTTOM = { r: 214, g: 209, b: 202 } as const;

/** The contact shadow: how dark at its centre, how soft, and how it is shaped under the product. */
export const SHADOW_OPACITY = 0.3;
/** Blur radius as a fraction of the square's edge — soft enough to read as light, not as a smudge. */
export const SHADOW_BLUR_RATIO = 0.014;
/** The ellipse's half-width as a fraction of the product's width, and its half-height of its own. */
export const SHADOW_WIDTH_RATIO = 0.46;
export const SHADOW_HEIGHT_RATIO = 0.05;
/** How far the ellipse's centre sits below the product's base, as a fraction of the edge. */
export const SHADOW_DROP_RATIO = 0.008;

/** Opaque white, as the one marketplace main images are measured against (spec A2). */
export const PURE_WHITE = { r: 255, g: 255, b: 255, alpha: 1 } as const;

/** The largest a product may be drawn, so the square around it still fits the stored ceiling. */
export function contentEdge(): number {
  return Math.floor(MAX_IMAGE_EDGE * CONTENT_RATIO);
}

/** The square a product of this size wants: big enough to carry the margin, never past the ceiling. */
export function squareEdgeFor(width: number, height: number): number {
  return Math.min(MAX_IMAGE_EDGE, Math.ceil(Math.max(width, height) / CONTENT_RATIO));
}

export interface Box {
  width: number;
  height: number;
}

/** The box a product may occupy on a canvas of this size: the same margin, on both axes. */
export function contentBox(canvas: Box): Box {
  return { width: Math.floor(canvas.width * CONTENT_RATIO), height: Math.floor(canvas.height * CONTENT_RATIO) };
}

/** Centred on any canvas. A square is the case where the two edges are the same number. */
export function centreIn(canvas: Box, width: number, height: number): Placement {
  return { left: Math.round((canvas.width - width) / 2), top: Math.round((canvas.height - height) / 2) };
}

export function centreOn(edge: number, width: number, height: number): Placement {
  return centreIn({ width: edge, height: edge }, width, height);
}

/**
 * The cut-out at the size it will be placed at. Resized *before* the identity check rather than
 * during the composite, so what is compared is what was placed: a resize is a size we chose, while
 * a change during the composite is the product being redrawn (trd D4).
 */
export async function fitInto(cutout: Buffer, box: Box): Promise<{ bytes: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(cutout)
    .resize({ width: box.width, height: box.height, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
}

/** The square case: the content box of a canvas at the stored ceiling. */
export async function fitForBackdrop(cutout: Buffer): Promise<{ bytes: Buffer; width: number; height: number }> {
  const edge = contentEdge();
  return await fitInto(cutout, { width: edge, height: edge });
}

/** The studio's backdrop as raw pixels: one linear ramp down the square, top stop to bottom stop. */
export function verticalGradient(edge: number): { data: Buffer; width: number; height: number; channels: 3 } {
  const data = Buffer.alloc(edge * edge * 3);
  for (let y = 0; y < edge; y += 1) {
    const t = edge === 1 ? 0 : y / (edge - 1);
    const r = Math.round(STUDIO_GRADIENT_TOP.r + (STUDIO_GRADIENT_BOTTOM.r - STUDIO_GRADIENT_TOP.r) * t);
    const g = Math.round(STUDIO_GRADIENT_TOP.g + (STUDIO_GRADIENT_BOTTOM.g - STUDIO_GRADIENT_TOP.g) * t);
    const b = Math.round(STUDIO_GRADIENT_TOP.b + (STUDIO_GRADIENT_BOTTOM.b - STUDIO_GRADIENT_TOP.b) * t);
    for (let x = 0; x < edge; x += 1) {
      const at = (y * edge + x) * 3;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
    }
  }
  return { data, width: edge, height: edge, channels: 3 };
}

/**
 * The shadow the product would cast on the surface it stands on: a flat ellipse under its base,
 * blurred until it has no edge of its own. Black with a varying alpha, so it darkens the backdrop
 * rather than painting a grey shape on it.
 */
export async function contactShadow(
  edge: number,
  product: { left: number; top: number; width: number; height: number },
): Promise<Buffer> {
  const centreX = product.left + product.width / 2;
  const centreY = product.top + product.height + edge * SHADOW_DROP_RATIO;
  const radiusX = Math.max(1, product.width * SHADOW_WIDTH_RATIO);
  const radiusY = Math.max(1, product.height * SHADOW_HEIGHT_RATIO);
  const peak = Math.round(SHADOW_OPACITY * 255);

  const mask = Buffer.alloc(edge * edge);
  for (let y = 0; y < edge; y += 1) {
    for (let x = 0; x < edge; x += 1) {
      const dx = (x - centreX) / radiusX;
      const dy = (y - centreY) / radiusY;
      if (dx * dx + dy * dy <= 1) mask[y * edge + x] = peak;
    }
  }

  // `toColourspace` before `raw`, or sharp writes the blurred mask back out as three sRGB
  // channels and `joinChannel` is handed three times the bytes it was told to expect.
  const softened = await sharp(mask, { raw: { width: edge, height: edge, channels: 1 } })
    .blur(Math.max(0.3, edge * SHADOW_BLUR_RATIO))
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  return await sharp({ create: { width: edge, height: edge, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .joinChannel(softened, { raw: { width: edge, height: edge, channels: 1 } })
    .png()
    .toBuffer();
}
