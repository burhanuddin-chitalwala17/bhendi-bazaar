import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";

/** Where the cut-out was placed in the result, in the result's pixels. */
export interface Placement {
  left: number;
  top: number;
}

/** Full opacity. A pixel below this was blended with whatever is behind it and is not the product. */
const OPAQUE = 255;

/**
 * The product in the result is the product we put there (spec R4, trd D4).
 *
 * Every opaque pixel of the cut-out must appear, byte for byte, at its placement in the result.
 * Compared with no tolerance and no sampling: a shape that is nearly right is the failure mode this
 * exists to catch, because a repainted logo reads as a rendering artefact rather than as a bug.
 *
 * Run on the composite before it is encoded. WebP is lossy, so comparing after the encoder would
 * measure the encoder rather than the pipeline, and would have to be given a tolerance — which is
 * exactly the tolerance a redrawn product would hide inside.
 */
export async function assertProductPixelsKept(cutout: Buffer, result: Buffer, placement: Placement): Promise<void> {
  const product = await sharp(cutout).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const composed = await sharp(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const { width: pw, height: ph } = product.info;
  const { width: cw, height: ch } = composed.info;
  const { left, top } = placement;
  if (left < 0 || top < 0 || left + pw > cw || top + ph > ch) {
    throw new DomainError("The improvement did not keep the product whole");
  }

  for (let y = 0; y < ph; y += 1) {
    for (let x = 0; x < pw; x += 1) {
      const source = (y * pw + x) * 4;
      if (product.data[source + 3] !== OPAQUE) continue;
      const target = ((top + y) * cw + (left + x)) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        if (product.data[source + channel] !== composed.data[target + channel]) {
          throw new DomainError("The improvement changed the product itself, so it was not kept");
        }
      }
    }
  }
}
