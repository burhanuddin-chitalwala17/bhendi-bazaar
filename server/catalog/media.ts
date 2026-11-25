/**
 * A product's gallery items: photographs we host, videos we host, videos we embed.
 *
 * One declaration for the closed set and the shapes around it, imported by the server,
 * the Zod schema, and the components — `ProductFlag` is declared twice and is the
 * reason this one is not (CONTRACTS.md).
 *
 * Why a YouTube video is a reference rather than a file: ADR-0017. Why a hosted one is a
 * file after all: ADR-0039. This module is loaded in the browser, so nothing here may import
 * the Prisma client as a value.
 */

import type { MediaAssetState } from "@prisma/client";
import { VIDEO_TRANSFORM } from "@server/catalog/video";

export const MEDIA_KINDS = ["IMAGE", "YOUTUBE", "VIDEO"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** What a write path accepts for one gallery item. `position` is the array index. */
export interface ProductMediaInput {
  kind: MediaKind;
  /** A stored URL for IMAGE and VIDEO, a bare video id for YOUTUBE — never a provider URL. */
  ref: string;
  description?: string;
  isThumbnail: boolean;
  /** The category slot this photograph fills; absent for an extra or a video (media-library R4). */
  slot?: string | null;
}

/** Where a hosted video is between upload and playable (video-hosting D1, R3, R7). */
export const PRODUCT_MEDIA_STATES = ["processing", "ready", "failed"] as const;
export type ProductMediaState = (typeof PRODUCT_MEDIA_STATES)[number];

/** One playable file made from a hosted video, named by the rendition it is (video-hosting D3). */
export interface ProductMediaRendition {
  key: string;
  url: string;
  width: number;
  height: number;
}

/** What a read path returns for one gallery item, in gallery order. */
export interface ProductMediaDto {
  id: string;
  kind: MediaKind;
  ref: string;
  description: string | null;
  isThumbnail: boolean;
  slot: string | null;
  /** The still that stands in for a hosted video (video-hosting D5); null for a photograph or a link. */
  poster: string | null;
  durationMs: number | null;
  /** Largest first, as declared; empty until the worker is done, and always for a photograph or a link. */
  renditions: ProductMediaRendition[];
  /** Null for a photograph or a link: only a hosted video has somewhere to be on the way to. */
  state: ProductMediaState | null;
}

/** A gallery row as either product read selects it: the row, and the asset behind a VIDEO row. */
export interface ProductMediaRow {
  id: string;
  kind: MediaKind;
  ref: string;
  description: string | null;
  isThumbnail: boolean;
  slot: string | null;
  asset: {
    state: MediaAssetState;
    durationMs: number | null;
    /** Ready derivatives only — the select filters them — with the transform that says what each is. */
    derivatives: VideoDerivativeRow[];
    /** The photograph the org member chose over the derived frame (video-hosting spec R8), if any. */
    posterAsset: { ref: string } | null;
  } | null;
}

/** A ready asset made from a video's source, as either select reads it. */
export interface VideoDerivativeRow {
  ref: string;
  width: number | null;
  height: number | null;
  transform: unknown;
}

/**
 * The asset's state as the gallery tells it. A lookup rather than a chain of comparisons, so
 * the compiler holds it complete when the enum grows. RETIRED is unreachable for a row that
 * still references the asset (media-library R7) and reads as failed rather than as nothing.
 */
const GALLERY_STATE: Record<MediaAssetState, ProductMediaState> = {
  PENDING: "processing",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
  RETIRED: "failed",
};

function renditionKeyOf(transform: unknown): string | null {
  if (!transform || typeof transform !== "object") return null;
  const { kind, key } = transform as { kind?: unknown; key?: unknown };
  return kind === VIDEO_TRANSFORM.RENDITION && typeof key === "string" ? key : null;
}

function isPoster(transform: unknown): boolean {
  return !!transform && typeof transform === "object" && (transform as { kind?: unknown }).kind === VIDEO_TRANSFORM.POSTER;
}

/**
 * What a video's derivatives amount to, for every read that shows one (video-hosting D3, D5, R8):
 * the poster is the photograph the org member chose when there is one, else the frame the worker
 * cut; the renditions are the playable files, largest first. Declared once so the product page and
 * the library cannot resolve the same asset to two different pictures.
 */
export function resolveVideoDerivatives(
  derivatives: readonly VideoDerivativeRow[],
  chosenPoster: { ref: string } | null,
): { poster: string | null; renditions: ProductMediaRendition[] } {
  const renditions = derivatives.flatMap((derived) => {
    const key = renditionKeyOf(derived.transform);
    return key && derived.width && derived.height ? [{ key, url: derived.ref, width: derived.width, height: derived.height }] : [];
  });
  return {
    poster: chosenPoster?.ref ?? derivatives.find((derived) => isPoster(derived.transform))?.ref ?? null,
    renditions: renditions.sort((a, b) => b.height - a.height),
  };
}

/**
 * One row to one DTO, for both product reads (video-hosting D1, D5). A photograph or a link
 * carries the video fields empty; a hosted video gets its poster, renditions and state from
 * the asset the row was linked to on write. A VIDEO row whose link is missing — the asset has
 * not confirmed, or the backfill has not reached it — reads as processing.
 */
export function toProductMediaDto(row: ProductMediaRow): ProductMediaDto {
  const { asset, ...item } = row;
  if (item.kind !== "VIDEO") return { ...item, poster: null, durationMs: null, renditions: [], state: null };
  const { poster, renditions } = resolveVideoDerivatives(asset?.derivatives ?? [], asset?.posterAsset ?? null);
  return {
    ...item,
    poster,
    durationMs: asset?.durationMs ?? null,
    renditions,
    state: asset ? GALLERY_STATE[asset.state] : "processing",
  };
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

/**
 * Every size this store makes an image in, declared once (renditions R1, D1).
 *
 * Beside the two constants above because all three answer the same question and drift apart
 * the moment they do not: `MAX_IMAGE_EDGE` is the ceiling a stored original is kept under, and
 * no surface here may ask for more than it, or the rendition would be an upscale of what we
 * hold. Adding a channel is adding a row; `tests/unit/image-delivery.test.ts` holds every row
 * to the ceiling and to the zoom rule ([ADR-0027](../../docs/adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md)).
 *
 * `cover` fills the box and loses what does not fit; `inside` fits the whole picture within it
 * and keeps the shape; `blurFill` fits it on a blurred copy of itself. Nothing else pads, and
 * nothing stretches: where the pixels are not there, the rendition is made from the untouched
 * original instead (R4).
 */
export const MEDIA_SURFACES = {
  /** The product grid tile. Three to a row on a phone, so the pixels are modest (ADR-0016). */
  tile: { width: 600, height: 600, fit: "cover", quality: 80 },
  /** The product page's main image, which magnifies: its box times the zoom (ADR-0027). */
  gallery: { width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", quality: 82 },
  /** The strip under the gallery. Small, square, and never magnified. */
  thumb: { width: 200, height: 200, fit: "cover", quality: 78 },
  /** A shop's cover, full width at the top of its page and in the link preview. */
  cover: { width: 1600, height: 900, fit: "cover", quality: 82 },
  /** What a link preview shows. The one size every social host agrees on. */
  preview: { width: 1200, height: 630, fit: "cover", quality: 82 },
  /** A marketplace main image: square on white, at the size that turns their zoom on. */
  marketplace: { width: 1600, height: 1600, fit: "inside", quality: 85 },
  /** The same, as a JPEG on white, for a marketplace that refuses WebP (Amazon; marketplace-publish D2). */
  marketplaceJpeg: { width: 1600, height: 1600, fit: "inside", quality: 85, format: "jpeg" },
  /** A feed post, composed square and delivered at 1080 (channel-rules). */
  social: { width: 1080, height: 1080, fit: "cover", quality: 82 },
  /** Instagram's feed, square or 4:5, as the JPEG its container fetches (instagram-publishing D1). */
  instagramSquare: { width: 1080, height: 1080, fit: "cover", quality: 85, format: "jpeg", exactShape: true },
  instagramPortrait: { width: 1080, height: 1350, fit: "cover", quality: 85, format: "jpeg", exactShape: true },
  /** A 9:16 story never crops off the product: the whole picture on a blurred fill of itself (ux.md). */
  instagramStory: { width: 1080, height: 1920, fit: "blurFill", quality: 85, format: "jpeg" },
} as const satisfies Record<string, MediaSurface>;

export interface MediaSurface {
  width: number;
  height: number;
  /**
   * `cover` fills and crops; `inside` fits the whole picture and keeps its shape; `blurFill` fits it
   * inside the full box, filled behind with a blurred cover of itself.
   */
  fit: "cover" | "inside" | "blurFill";
  /** Whole-number quality as sharp takes it, not the 0-1 fraction `IMAGE_QUALITY` uses. */
  quality: number;
  /** WebP unless a destination refuses it; a JPEG is flattened onto white, having no transparency. */
  format?: "jpeg";
  /** A `cover` too small for the box is cut to the box's shape and sent smaller, never left off-shape. */
  exactShape?: true;
}

export type MediaSurfaceKey = keyof typeof MEDIA_SURFACES;

export const MEDIA_SURFACE_KEYS = Object.keys(MEDIA_SURFACES) as MediaSurfaceKey[];

export const isMediaSurface = (value: string): value is MediaSurfaceKey =>
  Object.hasOwn(MEDIA_SURFACES, value);

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
