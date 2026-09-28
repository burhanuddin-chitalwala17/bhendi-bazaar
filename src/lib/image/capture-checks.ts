import type { CaptureFrame } from "@server/catalog/capture-checks";

/**
 * The frame the checks read: a fixed-size downscale, so the cost is the same for a 12MP phone
 * photo and a thumbnail (media-library D6). 128px on the long edge is enough for a mean and a
 * Laplacian and small enough that the analysis is never what the org member waits on.
 */
export const ANALYSIS_LONG_EDGE = 128;

/**
 * Draws the picked file small, reads it back as grey, and hands over the frame plus the file's
 * own dimensions. Null where the browser cannot decode it or has no canvas — the upload then
 * simply goes unchecked, which is the advisory contract (spec R8).
 */
export async function analyseCapture(file: File): Promise<CaptureFrame | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  try {
    const scale = Math.min(1, ANALYSIS_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);

    const { data } = context.getImageData(0, 0, width, height);
    const gray = new Uint8ClampedArray(width * height);
    for (let pixel = 0, byte = 0; pixel < gray.length; pixel += 1, byte += 4) {
      gray[pixel] = 0.299 * data[byte] + 0.587 * data[byte + 1] + 0.114 * data[byte + 2];
    }
    return { gray, width, height, sourceWidth: bitmap.width, sourceHeight: bitmap.height };
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}
