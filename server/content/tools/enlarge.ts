import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import { MAX_IMAGE_EDGE } from "@server/catalog/media";
import { PROPOSAL_MIME } from "@server/content/enhancement.types";
import { WEBP_QUALITY, type ToolResult } from "@server/content/tools/tool";

/**
 * Make the picture big enough for a marketplace to accept (spec R1 `enlarge`, A4; trd D2).
 *
 * A plain high-quality resize, on our own CPU, with no service behind it. That is a fidelity
 * decision before it is a price one: an AI upscaler reconstructs detail that was never in the
 * photograph, which changes the product's own pixels — exactly what trd D4 refuses to let a
 * service do. A resize cannot change what the product looks like; it only makes the file large
 * enough for a channel to take it.
 */

export interface EnlargeInput {
  bytes: Buffer;
  /** The long edge to clear, from the channel rules; capped here at the stored ceiling. */
  targetLongEdge: number;
}

export async function enlarge({ bytes, targetLongEdge }: EnlargeInput): Promise<ToolResult> {
  const target = Math.min(targetLongEdge, MAX_IMAGE_EDGE);

  // `rotate()` with no angle bakes the EXIF orientation in, so the long edge measured below is
  // the one a marketplace will measure. Raw, because that is the only way to read the size
  // *after* the turn rather than before it.
  const decoded = await sharp(bytes, { failOn: "error" })
    .rotate()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch((cause: unknown) => {
      // Bytes no decoder reads are the org member's to hear about (spec R10), not the queue's to retry.
      throw new DomainError("This photo could not be read as an image", { cause });
    });

  const { width, height, channels } = decoded.info;
  const longEdge = Math.max(width, height);
  if (longEdge >= target) {
    // A proposal that changes nothing still costs a slot and still asks for a decision.
    throw new DomainError(`This photo is already ${longEdge}px on its long side, so there is nothing to make bigger`);
  }

  // A whole factor, and the smallest that clears the target: each source pixel becomes a whole
  // block, and the picture is never blown up further than the channel actually asked for.
  const factor = Math.ceil(target / longEdge);
  const enlarged = Math.min(longEdge * factor, MAX_IMAGE_EDGE);
  // One side is given and sharp derives the other, so the shape is kept without our rounding.
  const side = width >= height ? { width: enlarged } : { height: enlarged };

  const { data, info } = await sharp(decoded.data, { raw: { width, height, channels } })
    .resize({ ...side, kernel: "lanczos3" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { output: data, mimeType: PROPOSAL_MIME.WEBP, width: info.width, height: info.height };
}
