import type { MediaAssetKind, MediaAssetSource, MediaAssetState } from "@prisma/client";

/** Tiles per page: eight rows of the 3-up phone grid (ADR-0016). */
export const MEDIA_LIBRARY_PAGE_SIZE = 24;

/**
 * An asset as the org portal sees it (media-library trd D1, spec R6). `uses` is the number of
 * places that point at it, derived at read time, never stored (D7). Private to the portal: a
 * buyer-facing payload carries `ProductMediaDto`, not this.
 */
export interface MediaAssetDto {
  id: string;
  kind: MediaAssetKind;
  ref: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mimeType: string | null;
  source: MediaAssetSource;
  state: MediaAssetState;
  uses: number;
  createdAt: string;
  retiredAt: string | null;
  /** A hosted video's poster frame once the worker has made one; null for anything else (video-hosting D7). */
  poster: string | null;
  durationMs: number | null;
  /** Why a video is FAILED, in the org member's words (spec R7); null otherwise. */
  failureReason: string | null;
}

export const MEDIA_USE_KINDS = [
  "product",
  "category",
  "storefront-logo",
  "storefront-hero",
  "storefront-banner",
  "home-banner",
  "derived",
] as const;
export type MediaUseKind = (typeof MEDIA_USE_KINDS)[number];

/** One place an asset is used: enough to name it to the org and to link to it. */
export interface MediaUseDto {
  kind: MediaUseKind;
  id: string;
  label: string;
  slot: string | null;
}

export interface MediaAssetDetailDto {
  asset: MediaAssetDto;
  uses: MediaUseDto[];
}

/** The relation counts that together mean "something points at this asset". */
export interface ReferenceCounts {
  productMedia: number;
  categoryHeroes: number;
  profileLogos: number;
  profileHeroes: number;
  orgBanners: number;
  banners: number;
  derivatives: number;
}

export function totalReferences(counts: ReferenceCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

export interface MediaAssetRow {
  id: string;
  kind: MediaAssetKind;
  ref: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mimeType: string | null;
  source: MediaAssetSource;
  state: MediaAssetState;
  durationMs: number | null;
  failureReason: string | null;
  createdAt: Date;
  retiredAt: Date | null;
  /** The poster derivative, at most one, as the library select joins it. */
  derivatives: { ref: string }[];
  _count: ReferenceCounts;
}

export function toMediaAssetDto(row: MediaAssetRow): MediaAssetDto {
  return {
    id: row.id,
    kind: row.kind,
    ref: row.ref,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    mimeType: row.mimeType,
    source: row.source,
    state: row.state,
    uses: totalReferences(row._count),
    createdAt: row.createdAt.toISOString(),
    retiredAt: row.retiredAt ? row.retiredAt.toISOString() : null,
    poster: row.derivatives[0]?.ref ?? null,
    durationMs: row.durationMs,
    failureReason: row.failureReason,
  };
}

const USE_NOUNS: Record<MediaUseKind, [singular: string, plural: string]> = {
  product: ["product", "products"],
  category: ["category", "categories"],
  "storefront-logo": ["storefront logo", "storefront logos"],
  "storefront-hero": ["storefront hero", "storefront heroes"],
  "storefront-banner": ["storefront banner", "storefront banners"],
  "home-banner": ["home banner", "home banners"],
  derived: ["derived image", "derived images"],
};

/** "2 products and 1 storefront banner" — what a refused retirement names (spec A3). */
export function describeUses(uses: readonly MediaUseDto[]): string {
  const counts = new Map<MediaUseKind, number>();
  for (const use of uses) counts.set(use.kind, (counts.get(use.kind) ?? 0) + 1);
  const parts = MEDIA_USE_KINDS.filter((kind) => counts.has(kind)).map((kind) => {
    const count = counts.get(kind) ?? 0;
    return `${count} ${USE_NOUNS[kind][count === 1 ? 0 : 1]}`;
  });
  if (parts.length <= 1) return parts[0] ?? "nothing";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
