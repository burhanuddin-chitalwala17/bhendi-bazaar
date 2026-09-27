import sharp from "sharp";
import { PROPOSAL_MIME } from "@server/content/enhancement.types";
import type { Segmenter } from "@server/content/providers/segment";
import { cutOutProduct } from "@server/content/tools/cutout";
import { PURE_WHITE, centreOn, fitForBackdrop, squareEdgeFor } from "@server/content/tools/backdrop";
import { assertProductPixelsKept } from "@server/content/tools/pixel-identity";
import { WEBP_QUALITY, type ToolInput, type ToolResult } from "@server/content/tools/tool";

/**
 * The product on pure white, padded to a square (spec R1, A2) — the shape a marketplace main image
 * wants, and the one a phone in a shop never produces. The background is RGB 255,255,255 and the
 * product is centred with the declared margin around it; nothing is stretched to fill the square.
 *
 * The product's pixels are checked against the cut-out before the result is encoded (trd D4): a run
 * that changed them fails rather than proposing something the org member would have to notice.
 */
export async function onWhite(input: ToolInput, segmenter: Segmenter): Promise<ToolResult> {
  const placed = await fitForBackdrop((await cutOutProduct(input, segmenter)).bytes);
  const edge = squareEdgeFor(placed.width, placed.height);
  const at = centreOn(edge, placed.width, placed.height);

  const composed = await sharp({ create: { width: edge, height: edge, channels: 4, background: PURE_WHITE } })
    .composite([{ input: placed.bytes, left: at.left, top: at.top }])
    .removeAlpha()
    .png()
    .toBuffer();
  await assertProductPixelsKept(placed.bytes, composed, at);

  const { data, info } = await sharp(composed).webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
  return { output: data, mimeType: PROPOSAL_MIME.WEBP, width: info.width, height: info.height };
}
