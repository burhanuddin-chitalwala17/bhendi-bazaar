import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import { MAX_IMAGE_EDGE } from "@server/catalog/media";
import { PROPOSAL_MIME } from "@server/content/enhancement.types";
import type { Segmenter } from "@server/content/providers/segment";
import { CUTOUT_MARGIN_RATIO, CUTOUT_MIN_MARGIN_PX, PRODUCT_ALPHA_THRESHOLD } from "@server/content/tools/backdrop";
import type { ToolInput, ToolResult } from "@server/content/tools/tool";

/** A trimmed cut-out: the product's own pixels, its transparency intact, and how big it now is. */
export interface CutOut {
  bytes: Buffer;
  width: number;
  height: number;
}

interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The rectangle the product actually occupies. Measured from the alpha channel rather than left to
 * sharp's `trim`, which decides what a border is from the corner pixel — fine for a photograph with
 * a flat frame, guesswork on a cut-out whose corners are already empty.
 */
function productBounds(alpha: Buffer, width: number, height: number, channels: number): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[(y * width + x) * channels + 3] < PRODUCT_ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * The product alone, on nothing (spec R1): the service's cut-out, trimmed to what it actually kept
 * with an even margin around it, and capped at the stored ceiling (ADR-0026). PNG throughout —
 * WebP would be smaller and would flatten the transparency that *is* the result.
 */
export async function cutOutProduct(input: ToolInput, segmenter: Segmenter): Promise<CutOut> {
  const cut = await segmenter.cutOut(input);

  const raw = await sharp(cut)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch((cause: unknown) => {
      throw new DomainError("The cut-out came back as something we could not read", { cause });
    });

  const { width, height, channels } = raw.info;
  const bounds = productBounds(raw.data, width, height, channels);
  if (!bounds) throw new DomainError("No product could be found in this photo to cut out");

  const margin = Math.max(CUTOUT_MIN_MARGIN_PX, Math.round(Math.max(bounds.width, bounds.height) * CUTOUT_MARGIN_RATIO));
  const left = Math.max(0, bounds.left - margin);
  const top = Math.max(0, bounds.top - margin);
  const { data, info } = await sharp(cut)
    .ensureAlpha()
    .extract({
      left,
      top,
      width: Math.min(width - left, bounds.width + margin * 2),
      height: Math.min(height - top, bounds.height + margin * 2),
    })
    .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });

  return { bytes: data, width: info.width, height: info.height };
}

/** The tool itself: a cut-out is already the proposal, so there is nothing further to compose. */
export async function cutOut(input: ToolInput, segmenter: Segmenter): Promise<ToolResult> {
  const product = await cutOutProduct(input, segmenter);
  return { output: product.bytes, mimeType: PROPOSAL_MIME.PNG, width: product.width, height: product.height };
}
