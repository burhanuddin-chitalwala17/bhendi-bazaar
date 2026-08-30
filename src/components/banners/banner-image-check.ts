import { BANNER_IMAGE } from "@/lib/config";

/** The one sentence an admin is shown, built from the same constant the check uses. */
export const BANNER_IMAGE_HINT = `${BANNER_IMAGE.width}×${BANNER_IMAGE.height} or larger, roughly 5:2 landscape. Keep the left third clear — the headline sits there.`;

/**
 * Refuses a file the banner cannot render well, and says what it should have been.
 * Deliberately client-side: the uploader is already a platform admin, and re-measuring
 * on the server would mean an image library to defend nothing.
 */
export async function checkBannerImage(file: File): Promise<string | null> {
  const dimensions = await readDimensions(file);
  if (!dimensions) return "That file could not be read as an image.";
  return describeBannerImageProblem(dimensions.width, dimensions.height);
}

/** The judgement, without the file — pure, so it can be tested and reasoned about. */
export function describeBannerImageProblem(
  width: number,
  height: number
): string | null {
  if (width <= 0 || height <= 0) return "That file could not be read as an image.";
  if (width < BANNER_IMAGE.width) {
    return `That image is ${width}px wide. The banner needs at least ${BANNER_IMAGE.width}px, or it will look soft on a large screen.`;
  }

  const ratio = width / height;
  if (Math.abs(ratio - BANNER_IMAGE.ratio) > BANNER_IMAGE.ratioTolerance) {
    return `That image is ${width}×${height} (${ratio.toFixed(2)}:1). The banner is a fixed landscape box — bring something near ${BANNER_IMAGE.width}×${BANNER_IMAGE.height} or it will be cropped hard.`;
  }
  return null;
}

function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}
