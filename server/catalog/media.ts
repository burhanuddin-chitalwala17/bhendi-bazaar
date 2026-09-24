/**
 * A product's gallery items: photographs we host, videos we embed.
 *
 * One declaration for the closed set and the shapes around it, imported by the server,
 * the Zod schema, and the components — `ProductFlag` is declared twice and is the
 * reason this one is not (CONTRACTS.md).
 *
 * Why video is a reference rather than a file: ADR-0017.
 */

export const MEDIA_KINDS = ["IMAGE", "YOUTUBE"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** What a write path accepts for one gallery item. `position` is the array index. */
export interface ProductMediaInput {
  kind: MediaKind;
  /** A blob URL for IMAGE, a bare video id for YOUTUBE — never a provider URL. */
  ref: string;
  description?: string;
  isThumbnail: boolean;
}

/** What a read path returns for one gallery item, in gallery order. */
export interface ProductMediaDto {
  id: string;
  kind: MediaKind;
  ref: string;
  description: string | null;
  isThumbnail: boolean;
}

/** R14 — a page-weight limit before it is a storage one. */
export const MAX_MEDIA_PER_PRODUCT = 10;

/**
 * What one review may carry (review-media R1, R6, trd.md D4).
 *
 * Here beside the product's budget rather than in the review module: two paths enforce
 * every image limit in this store — the server route with sharp, and the browser wizard
 * on a canvas — and a budget one of them did not know about would be no budget at all.
 * Four photographs is page weight and storage before it is editorial; one video, because
 * a review is one person's account of one purchase.
 */
export const MAX_REVIEW_PHOTOS = 4;
export const MAX_REVIEW_VIDEOS = 1;

/**
 * How far a photograph can be magnified on the surfaces that allow it — the gallery's
 * pinch and hover zoom, and the lightbox. Declared here because the stored ceiling below
 * is derived from it: the two cannot be chosen independently without the zoom going soft.
 */
export const MAX_ZOOM_SCALE = 3;

/**
 * The longest edge of a stored photograph, and the quality it is encoded at.
 *
 * Here rather than in image-upload.ts because two paths must agree on it: the server
 * route normalises with sharp, and the bulk wizard — which uploads browser-to-Blob to
 * dodge the 4.5MB function body cap, so no server code sees the file — normalises on a
 * canvas. A budget one path enforced and the other did not would be no budget at all
 * (ADR-0026).
 *
 * 2048 rather than the 1600 first shipped: a 3:4 photograph in a 1440x900 lightbox
 * displays ~675px wide, and MAX_ZOOM_SCALE asks for three times that. 1600 could not
 * supply it and measured twice the error of 2000 at full zoom, on the one surface where
 * a buyer is inspecting weave and stonework. The extra ~70KB per image is the cheapest
 * part of this whole exercise (ADR-0027).
 */
export const MAX_IMAGE_EDGE = 2048;
export const IMAGE_QUALITY = 0.82;

/**
 * What to declare in `sizes` on a surface that can be magnified.
 *
 * Deliberately larger than the CSS box, which ADR-0026 otherwise treats as a defect:
 * a zoomable element's real slot is its box times the zoom, because the browser scales
 * the image it already downloaded rather than fetching a sharper one. Stated as a
 * multiple of MAX_ZOOM_SCALE so raising the zoom cannot silently outrun the pixels.
 *
 * Applied only to the two inspect surfaces. The listing tile does not zoom and must
 * stay honest — overstating there is what cost the transfer allowance (ADR-0027).
 */
export const ZOOMABLE_IMAGE_SIZES = `${Math.min(MAX_ZOOM_SCALE, 2) * 100}vw`;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The video id out of whatever was pasted, or null if there isn't one.
 *
 * Accepts the four link shapes YouTube itself hands out (watch, youtu.be, shorts,
 * embed) and a bare id, because copying from the app gives a different one
 * than copying from the address bar. Stored as the id alone (ADR-0017
 * decision 2), so the host is swappable by backfill.
 */
export function parseYoutubeRef(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (YOUTUBE_ID.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  const candidate =
    host === "youtu.be"
      ? url.pathname.slice(1)
      : host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com"
        ? url.searchParams.get("v") ?? url.pathname.replace(/^\/(shorts|embed|v)\//, "")
        : null;

  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

/**
 * hqdefault, not maxresdefault: the latter 404s for any video never published above
 * 720p, and a broken poster is worse than a slightly soft one.
 */
export function youtubePosterUrl(ref: string): string {
  return `https://i.ytimg.com/vi/${ref}/hqdefault.jpg`;
}

/** nocookie host, and only ever mounted on a tap (ADR-0017 decision 3). */
export function youtubeEmbedUrl(ref: string): string {
  return `https://www.youtube-nocookie.com/embed/${ref}?autoplay=1&rel=0`;
}

export function youtubeWatchUrl(ref: string): string {
  return `https://www.youtube.com/watch?v=${ref}`;
}

/** The cover, which R15 guarantees exists. Throws rather than inventing one (D4a). */
export function coverOf<T extends { kind: MediaKind; isThumbnail: boolean; ref: string }>(
  media: T[]
): T {
  const cover = media.find((item) => item.isThumbnail);
  if (!cover) {
    throw new Error("product has no cover media — R15 should make this unreachable");
  }
  return cover;
}
