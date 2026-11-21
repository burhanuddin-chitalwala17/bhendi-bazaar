import { DomainError } from "@server/shared/domain-error";
import { renditionUrl } from "@server/content/renditions.service";
import { isAiMade } from "@server/content/enhancement.types";

/** Said when every photo a listing would send is AI-made (improve-with-ai R11). */
export const AI_ONLY_PHOTOS_MESSAGE =
  "A marketplace needs a real photograph as the main image. AI pictures can only be extra photos — add a photo you took.";

/**
 * The listing's photos with any AI-made one moved behind the first real photograph (R11): a
 * marketplace's main image is never AI-made, and the product's own gallery is not changed.
 */
export function mainImageFirst<T extends { asset: { transform?: unknown } | null }>(photos: readonly T[]): T[] {
  const firstReal = photos.findIndex((photo) => !isAiMade(photo.asset?.transform));
  if (photos.length > 0 && firstReal === -1) throw new DomainError(AI_ONLY_PHOTOS_MESSAGE);
  if (firstReal <= 0) return [...photos];
  return [photos[firstReal] as T, ...photos.filter((_, index) => index !== firstReal)];
}

/**
 * The photo addresses a marketplace fetches, in order (marketplace-publish D2). Our photos are stored
 * as WebP, which Amazon refuses, so a photo in a format the marketplace does not take goes as a JPEG
 * rendition of it, made once and kept. One in a refused format with no stored asset to render from is left out.
 */
export async function marketplacePhotoUrls(
  orgId: string,
  media: ReadonlyArray<{ ref: string; assetId: string | null; asset: { mimeType: string | null; transform?: unknown } | null }>,
  refs: readonly string[],
  formats: readonly string[],
): Promise<string[]> {
  const chosen = refs.flatMap((ref) => media.filter((item) => item.ref === ref).slice(0, 1));
  const out: string[] = [];
  for (const m of mainImageFirst(chosen)) {
    const mime = m.asset?.mimeType ?? null;
    // A format we do not know goes as it is, for the marketplace to judge; one it refuses goes as a JPEG.
    if (formats.length === 0 || mime === null || formats.includes(mime)) out.push(m.ref);
    else if (m.assetId) out.push(await renditionUrl(orgId, m.assetId, "marketplaceJpeg"));
  }
  return out;
}
