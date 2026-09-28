import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import { PROPOSAL_MIME } from "@server/content/enhancement.types";
import { WEBP_QUALITY, type ToolResult } from "@server/content/tools/tool";

/** Output gamma above 1 lifts the midtones a dark phone photo lost; gentle, so a correct exposure barely moves. */
export const LIGHT_GAMMA = 1.15;
/** The unsharp mask: a small radius and a mild amount, enough to undo a phone's softness without haloes. */
export const LIGHT_SHARPEN = { sigma: 0.8, m1: 0.6, m2: 1.4 } as const;

/**
 * Exposure and sharpness, nothing else (spec R1 `light`, trd D2): the luminance is stretched to the
 * full range, the midtones lifted, an unsharp mask applied, and the picture written as WebP at the
 * stored quality. No resize and no colour cast — a product must still look like itself. Deterministic:
 * the same bytes in give the same bytes out, so a resumed run proposes the same file.
 *
 * Two passes because sharp orders its operations itself, gamma before normalise; run in one pass
 * the stretch would pull the lift straight back down. The raw hand-off between them is lossless.
 */
export async function lightFix(input: Buffer): Promise<ToolResult> {
  // `rotate()` with no angle bakes the EXIF orientation in, which the WebP would otherwise lose.
  const levelled = await sharp(input, { failOn: "error" })
    .rotate()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch((cause: unknown) => {
      // Bytes no decoder reads are the org member's to hear about (spec R10), not the queue's to retry.
      throw new DomainError("This photo could not be read as an image", { cause });
    });
  const { width, height, channels } = levelled.info;
  const { data, info } = await sharp(levelled.data, { raw: { width, height, channels } })
    .gamma(1, LIGHT_GAMMA)
    .sharpen(LIGHT_SHARPEN)
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { output: data, mimeType: PROPOSAL_MIME.WEBP, width: info.width, height: info.height };
}
