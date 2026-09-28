import sharp from "sharp";
import { PROPOSAL_MIME } from "@server/content/enhancement.types";
import type { Segmenter } from "@server/content/providers/segment";
import { cutOutProduct } from "@server/content/tools/cutout";
import { centreOn, contactShadow, fitForBackdrop, squareEdgeFor, verticalGradient } from "@server/content/tools/backdrop";
import { assertProductPixelsKept } from "@server/content/tools/pixel-identity";
import { WEBP_QUALITY, type ToolInput, type ToolResult } from "@server/content/tools/tool";

/**
 * The product on a plain studio backdrop (spec R1): a soft vertical ramp in one declared neutral,
 * with a blurred elliptical shadow where the product meets the surface. The shadow is what makes it
 * read as a photograph of an object standing somewhere rather than a sticker on a colour.
 *
 * Same guarantee as `white`: the product's pixels are compared to the cut-out's before encoding
 * (trd D4), so the backdrop is painted around the product and never over it.
 */
export async function inStudio(input: ToolInput, segmenter: Segmenter): Promise<ToolResult> {
  const placed = await fitForBackdrop((await cutOutProduct(input, segmenter)).bytes);
  const edge = squareEdgeFor(placed.width, placed.height);
  const at = centreOn(edge, placed.width, placed.height);

  const backdrop = verticalGradient(edge);
  const shadow = await contactShadow(edge, { ...at, width: placed.width, height: placed.height });
  const composed = await sharp(backdrop.data, {
    raw: { width: backdrop.width, height: backdrop.height, channels: backdrop.channels },
  })
    // Bottom to top: the surface, the shadow on it, then the product standing in the shadow.
    .composite([
      { input: shadow, left: 0, top: 0 },
      { input: placed.bytes, left: at.left, top: at.top },
    ])
    .removeAlpha()
    .png()
    .toBuffer();
  await assertProductPixelsKept(placed.bytes, composed, at);

  const { data, info } = await sharp(composed).webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
  return { output: data, mimeType: PROPOSAL_MIME.WEBP, width: info.width, height: info.height };
}
