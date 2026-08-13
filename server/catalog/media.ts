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
