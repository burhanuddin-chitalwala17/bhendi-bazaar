import { renditionUrl } from "@server/content/renditions.service";

/**
 * The photo addresses a marketplace fetches, in order (marketplace-publish D2). Our photos are stored
 * as WebP, which Amazon refuses, so a photo in a format the marketplace does not take goes as a JPEG
 * rendition of it, made once and kept. One in a refused format with no stored asset to render from is left out.
 */
export async function marketplacePhotoUrls(
  orgId: string,
  media: ReadonlyArray<{ ref: string; assetId: string | null; asset: { mimeType: string | null } | null }>,
  refs: readonly string[],
  formats: readonly string[],
): Promise<string[]> {
  const out: string[] = [];
  for (const ref of refs) {
    const m = media.find((item) => item.ref === ref);
    if (!m) continue;
    const mime = m.asset?.mimeType ?? null;
    // A format we do not know goes as it is, for the marketplace to judge; one it refuses goes as a JPEG.
    if (formats.length === 0 || mime === null || formats.includes(mime)) out.push(m.ref);
    else if (m.assetId) out.push(await renditionUrl(orgId, m.assetId, "marketplaceJpeg"));
  }
  return out;
}
