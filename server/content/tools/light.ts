import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import { IMAGE_QUALITY } from "@server/catalog/media";
import { PROPOSAL_MIME_TYPE } from "@server/content/enhancement.types";

/** What every tool hands back: the bytes to propose, what they are, and how big the picture is. */
export interface ToolResult {
  output: Buffer;
  mimeType: typeof PROPOSAL_MIME_TYPE;
  width: number;
  height: number;
}

/** Output gamma above 1 lifts the midtones a dark phone photo lost; gentle, so a correct exposure barely moves. */
export const LIGHT_GAMMA = 1.15;
/** The unsharp mask: a small radius and a mild amount, enough to undo a phone's softness without haloes. */
export const LIGHT_SHARPEN = { sigma: 0.8, m1: 0.6, m2: 1.4 } as const;
/** The same encoder setting as every stored photograph (ADR-0026), so a result weighs what its source does. */
const WEBP_QUALITY = Math.round(IMAGE_QUALITY * 100);

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
  return { output: data, mimeType: PROPOSAL_MIME_TYPE, width: info.width, height: info.height };
}
