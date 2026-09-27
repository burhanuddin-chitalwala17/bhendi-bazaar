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
    derivatives: { ref: string; width: number | null; height: number | null; transform: unknown }[];
  } | null;
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
 * One row to one DTO, for both product reads (video-hosting D1, D5). A photograph or a link
 * carries the video fields empty; a hosted video gets its poster, renditions and state from
 * the asset the row was linked to on write. A VIDEO row whose link is missing — the asset has
 * not confirmed, or the backfill has not reached it — reads as processing.
 */
export function toProductMediaDto(row: ProductMediaRow): ProductMediaDto {
  const { asset, ...item } = row;
  if (item.kind !== "VIDEO") return { ...item, poster: null, durationMs: null, renditions: [], state: null };
  const derivatives = asset?.derivatives ?? [];
  const renditions = derivatives.flatMap((derived) => {
    const key = renditionKeyOf(derived.transform);
    return key && derived.width && derived.height ? [{ key, url: derived.ref, width: derived.width, height: derived.height }] : [];
  });
  return {
    ...item,
    poster: derivatives.find((derived) => isPoster(derived.transform))?.ref ?? null,
    durationMs: asset?.durationMs ?? null,
    renditions: renditions.sort((a, b) => b.height - a.height),
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
