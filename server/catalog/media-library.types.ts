import type { MediaAssetKind, MediaAssetSource, MediaAssetState, MediaRetiredBy, MediaTag as PrismaMediaTag } from "@prisma/client";
import {
  resolveVideoDerivatives,
  youtubePosterUrl,
  type ProductMediaRendition,
  type VideoDerivativeRow,
} from "@server/catalog/media";

/**
 * What a shop says an image is for (ai-images/media-tags D1), mirrored from the Prisma enum so the
 * browser can load it; `satisfies` keeps the mirror complete.
 */
export const MEDIA_TAG = { PRODUCT: "PRODUCT", REFERENCE: "REFERENCE" } as const satisfies Record<PrismaMediaTag, PrismaMediaTag>;
export type MediaTag = (typeof MEDIA_TAG)[keyof typeof MEDIA_TAG];
export const MEDIA_TAGS = Object.values(MEDIA_TAG);

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
  /** How many places show it. Zero is the ordinary state of a library and is reported as nothing. */
  uses: number;
  /**
   * How many pictures were made from it — a crop, a rendition, an improvement. Not a use: none of
   * them stops working when this one leaves the library, but its bytes are kept while they exist.
   */
  derivedCount: number;
  /** What the shop says it is for; several at once (media-tags D1). */
  tags: MediaTag[];
  createdAt: string;
  /** Whose library this is; null is the platform's own collection (spec R12). */
  orgId: string | null;
  retiredAt: string | null;
  /** Who took it out, and why when the platform did. An org is never told which admin. */
  retiredBy: MediaRetiredBy | null;
  retiredReason: string | null;
  /** A hosted video's poster — the photograph the org member chose, else the worker's frame (video-hosting D7, R8); null for anything else. */
  poster: string | null;
  /** Whether that poster is a photograph somebody chose. Only then is there a choice to undo. */
  posterChosen: boolean;
  durationMs: number | null;
  /** A hosted video's playable files, largest first (video-hosting D5); empty until the worker is done, and always for anything else. */
  renditions: ProductMediaRendition[];
  /** Why a video is FAILED, in the org member's words (spec R7); null otherwise. */
  failureReason: string | null;
}

export const MEDIA_USE_KINDS = [
  "product",
  "category",
  "storefront-logo",
  "storefront-hero",
  "storefront-collection",
  "storefront-banner",
  "home-banner",
  "video-poster",
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
  /** A themed page's hero photos and collection pictures (storefront-themes D13, ADR-0058). */
  storefrontSlots: number;
  orgBanners: number;
  banners: number;
  /** The phone versions of the same (image-slots trd D2): shown, so a use like the desktop picture. */
  orgBannerPhones: number;
  storefrontSlotPhones: number;
  bannerPhones: number;
  /** The videos this photograph stands in for (spec R8): a poster in use is a photograph in use. */
  postersFor: number;
  /** Pictures made from this one. Counted, never added to the uses — see `MediaAssetDto.derivedCount`. */
  derivatives: number;
}

/** Everywhere it is shown. A derivative is lineage, not a use, so it is not one of these. */
export function totalUses({ derivatives: _lineage, ...shown }: ReferenceCounts): number {
  return Object.values(shown).reduce((sum, count) => sum + count, 0);
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
  orgId: string | null;
  retiredAt: Date | null;
  retiredBy: MediaRetiredBy | null;
  retiredReason: string | null;
  tags: MediaTag[];
  /** A video's ready poster frame and renditions, as the library select joins them; empty for a photograph. */
  derivatives: VideoDerivativeRow[];
  posterAsset: { ref: string } | null;
  _count: ReferenceCounts;
}

export function toMediaAssetDto(row: MediaAssetRow): MediaAssetDto {
  const { poster, renditions } = resolveVideoDerivatives(row.derivatives, row.posterAsset);
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
    uses: totalUses(row._count),
    derivedCount: row._count.derivatives,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    orgId: row.orgId,
    retiredAt: row.retiredAt ? row.retiredAt.toISOString() : null,
    retiredBy: row.retiredBy,
    retiredReason: row.retiredReason,
    poster,
    posterChosen: row.posterAsset !== null,
    durationMs: row.durationMs,
    renditions,
    failureReason: row.failureReason,
  };
}

const USE_NOUNS: Record<MediaUseKind, [singular: string, plural: string]> = {
  product: ["product", "products"],
  category: ["category", "categories"],
  "storefront-logo": ["storefront logo", "storefront logos"],
  "storefront-hero": ["storefront hero", "storefront heroes"],
  "storefront-collection": ["storefront collection", "storefront collections"],
  "storefront-banner": ["storefront banner", "storefront banners"],
  "home-banner": ["home banner", "home banners"],
  "video-poster": ["video poster", "video posters"],
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

/**
 * The picture that stands for an asset in a listing.
 *
 * A hosted video shows its poster, an embedded one the frame its host serves, and a
 * photograph is itself. Declared once because two surfaces list assets — the org's library
 * and the platform owner's — and a second spelling is how one of them starts showing a black
 * square for videos while the other does not.
 */
export function previewUrlFor(asset: Pick<MediaAssetDto, "kind" | "ref" | "poster">): string | null {
  if (asset.kind === "VIDEO_EMBED") return youtubePosterUrl(asset.ref);
  if (asset.kind === "VIDEO") return asset.poster;
  return asset.ref;
}
