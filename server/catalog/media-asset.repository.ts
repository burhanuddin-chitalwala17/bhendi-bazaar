import { prisma } from "@server/shared/prisma";
import { MediaAssetKind, MediaAssetSource, MediaAssetState, type Prisma } from "@prisma/client";
import type { MediaLibraryFilters } from "@/lib/validation/schemas/media-library.schema";
import { MEDIA_LIBRARY_PAGE_SIZE, type MediaAssetRow, type MediaUseDto } from "@server/catalog/media-library.types";
import { VIDEO_TRANSFORM } from "@server/catalog/video";

/** Every relation that can point at an asset. "Used" is `some` on any; "unused" is `none` on all. */
const REFERENCE_RELATIONS = [
  "productMedia",
  "categoryHeroes",
  "profileLogos",
  "profileHeroes",
  "orgBanners",
  "banners",
  "derivatives",
  // A photograph chosen as a video's poster (spec R8) is in use as surely as one in a gallery.
  "postersFor",
] as const;
const REFERENCE_COUNTS = Object.fromEntries(REFERENCE_RELATIONS.map((relation) => [relation, true])) as Record<
  (typeof REFERENCE_RELATIONS)[number],
  true
>;
const UNREFERENCED: Prisma.MediaAssetWhereInput = Object.fromEntries(
  REFERENCE_RELATIONS.map((relation) => [relation, { none: {} }]),
);
const REFERENCED: Prisma.MediaAssetWhereInput = {
  OR: REFERENCE_RELATIONS.map((relation) => ({ [relation]: { some: {} } })),
};

const LIBRARY_SELECT = {
  id: true,
  kind: true,
  ref: true,
  width: true,
  height: true,
  bytes: true,
  mimeType: true,
  source: true,
  state: true,
  durationMs: true,
  failureReason: true,
  createdAt: true,
  retiredAt: true,
  // A hosted video's poster frame and renditions, so its tile has a picture and its sheet can play
  // it (video-hosting D5, D7). A crop's transform has no `kind`, so a photograph's derivatives never match.
  derivatives: {
    where: {
      state: MediaAssetState.READY,
      OR: [
        { transform: { path: ["kind"], equals: VIDEO_TRANSFORM.POSTER } },
        { transform: { path: ["kind"], equals: VIDEO_TRANSFORM.RENDITION } },
      ],
    },
    select: { ref: true, width: true, height: true, transform: true },
  },
  // The photograph chosen over the frame (spec R8); its ref is what the tile shows when set.
  posterAsset: { select: { ref: true } },
  _count: { select: REFERENCE_COUNTS },
} satisfies Prisma.MediaAssetSelect;

/** What the library shows: ready assets, and a video on its way there or fallen short (spec R7). A pending upload is nobody's yet. */
const LIBRARY_STATES = [MediaAssetState.READY, MediaAssetState.PROCESSING, MediaAssetState.FAILED];

/** The library's filters as a Prisma `where`, scoped to one org and one state (spec R6). */
function libraryWhere(orgId: string, filters: MediaLibraryFilters): Prisma.MediaAssetWhereInput {
  const inProduct: Prisma.ProductMediaWhereInput | null =
    filters.productId || filters.slot
      ? { ...(filters.productId ? { productId: filters.productId } : {}), ...(filters.slot ? { slot: filters.slot } : {}) }
      : null;
  return {
    orgId,
    state: filters.retired ? MediaAssetState.RETIRED : { in: LIBRARY_STATES },
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.from || filters.to ? { createdAt: { gte: filters.from, lte: filters.to } } : {}),
    ...(inProduct ? { productMedia: { some: inProduct } } : {}),
    ...(filters.usage === "used" ? REFERENCED : filters.usage === "unused" ? UNREFERENCED : {}),
  };
}

/** A Prisma client or the transaction client a caller is already inside. */
export type MediaDb = Pick<typeof prisma, "mediaAsset">;

export interface PendingAssetInput {
  orgId: string | null;
  uploaderId: string | null;
  ref: string;
  objectKey: string;
  mimeType: string;
  bytes: number;
  /** IMAGE unless the presign was for a video (video-hosting D1). */
  kind?: MediaAssetKind;
  contentHash?: string | null;
  /** UPLOAD unless these bytes were made from another asset, which the next two then name (trd D6a). */
  source?: MediaAssetSource;
  derivedFromId?: string | null;
  transform?: Prisma.InputJsonValue | null;
}

/** A ready record: what is known about bytes the store already holds, or a URL we do not host. */
export interface ReadyAssetInput {
  orgId: string | null;
  uploaderId: string | null;
  ref: string;
  objectKey: string | null;
  mimeType: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  contentHash?: string | null;
  /** IMAGE unless said otherwise: the worker records a video's renditions as VIDEO (video-hosting D3). */
  kind?: MediaAssetKind;
  durationMs?: number | null;
  /** UPLOAD unless these bytes were made from another asset, which the next two then name. */
  source?: MediaAssetSource;
  derivedFromId?: string | null;
  transform?: Prisma.InputJsonValue | null;
}

export interface ConfirmedDimensions {
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
}

/** What the store holds for a video at confirm; its dimensions and duration wait for the worker. */
export interface StoredBytes {
  bytes: number;
  mimeType: string;
}

export interface ProbedVideo {
  width: number;
  height: number;
  durationMs: number;
}

/**
 * The one reader and writer of `MediaAsset` (ADR-0003, media-library trd D1). Rows are
 * created pending at presign and confirmed after the bytes land (D2); the backfill and the
 * server upload path create them ready. Nothing here deletes a ready asset — retirement is
 * a state (R7) — and only stale pending rows, which never had a confirmed object, go.
 */
export class MediaAssetRepository {
  async createPending(input: PendingAssetInput, db: MediaDb = prisma) {
    const { kind = MediaAssetKind.IMAGE, source = MediaAssetSource.UPLOAD, derivedFromId = null, transform = null, ...asset } = input;
    return await db.mediaAsset.create({
      data: {
        kind,
        source,
        state: MediaAssetState.PENDING,
        derivedFromId,
        // A JSON column takes Prisma's own null, not JavaScript's; leaving it out stores NULL.
        ...(transform === null ? {} : { transform }),
        ...asset,
      },
      select: { id: true, ref: true },
    });
  }

  /**
   * An image of this owner's that a crop may be made from (trd D6a). Ready, not merely present:
   * a pending source can still be swept, and a derivative pointing at it would block the sweep.
   * A null org is the platform's own collection.
   */
  async findReadySource(orgId: string | null, id: string, db: MediaDb = prisma) {
    return await db.mediaAsset.findFirst({
      where: { id, orgId, kind: MediaAssetKind.IMAGE, state: MediaAssetState.READY },
      select: { id: true, width: true, height: true },
    });
  }

  /** Confirm only moves a PENDING row; a second confirm is a no-op reported as `false`. */
  async confirm(id: string, dims: ConfirmedDimensions, db: MediaDb = prisma) {
    const result = await db.mediaAsset.updateMany({
      where: { id, state: MediaAssetState.PENDING },
      data: { ...dims, state: MediaAssetState.READY },
    });
    return result.count === 1;
  }

  /**
   * A video's confirm (video-hosting D1, D2): the bytes are in the store, so the row leaves PENDING,
   * but it is not ready until the worker has made it playable. One conditional statement, so a
   * second confirm moves nothing and enqueues nothing.
   */
  async startProcessing(id: string, stored: StoredBytes, db: MediaDb = prisma) {
    const result = await db.mediaAsset.updateMany({
      where: { id, state: MediaAssetState.PENDING },
      data: { ...stored, state: MediaAssetState.PROCESSING },
    });
    return result.count === 1;
  }

  /** The worker is done: the source gains what ffprobe read and becomes READY (video-hosting D3). */
  async finishProcessing(id: string, probe: ProbedVideo, db: MediaDb = prisma) {
    const result = await db.mediaAsset.updateMany({
      where: { id, state: MediaAssetState.PROCESSING },
      data: { ...probe, state: MediaAssetState.READY },
    });
    return result.count === 1;
  }

  /**
   * The worker could not make it playable (spec R7). The reason is what the org member reads;
   * `dropObject` says the bytes are gone too, which is the case for a clip past a limit.
   */
  async failProcessing(id: string, failureReason: string, options: { dropObject: boolean }, db: MediaDb = prisma) {
    const result = await db.mediaAsset.updateMany({
      where: { id, state: MediaAssetState.PROCESSING },
      data: { state: MediaAssetState.FAILED, failureReason, ...(options.dropObject ? { objectKey: null } : {}) },
    });
    return result.count === 1;
  }

  /** What has already been made from a source, so a re-run of the worker adds nothing (ADR-0038 D4). */
  async findDerivatives(sourceId: string, db: MediaDb = prisma) {
    return await db.mediaAsset.findMany({
      where: { derivedFromId: sourceId, state: { not: MediaAssetState.RETIRED } },
      select: { id: true, kind: true, ref: true, transform: true },
    });
  }

  async createReady(input: ReadyAssetInput, db: MediaDb = prisma) {
    const {
      kind = MediaAssetKind.IMAGE,
      source = MediaAssetSource.UPLOAD,
      derivedFromId = null,
      transform = null,
      durationMs = null,
      ...asset
    } = input;
    return await db.mediaAsset.create({
      data: {
        kind,
        source,
        state: MediaAssetState.READY,
        derivedFromId,
        durationMs,
        ...(transform === null ? {} : { transform }),
        ...asset,
      },
      select: { id: true, ref: true },
    });
  }

  /** A video reference the library knows about: an id and its owner, no bytes (spec R5a). */
  async createEmbed(input: { orgId: string | null; ref: string }, db: MediaDb = prisma) {
    return await db.mediaAsset.create({
      data: {
        kind: MediaAssetKind.VIDEO_EMBED,
        source: MediaAssetSource.EMBED,
        state: MediaAssetState.READY,
        ref: input.ref,
        orgId: input.orgId,
        uploaderId: null,
        objectKey: null,
        mimeType: null,
        bytes: null,
      },
      select: { id: true, ref: true },
    });
  }

  async findById(id: string, db: MediaDb = prisma) {
    return await db.mediaAsset.findUnique({ where: { id } });
  }

  async findByRef(kind: MediaAssetKind, ref: string, db: MediaDb = prisma) {
    return await db.mediaAsset.findFirst({
      where: { kind, ref, state: { not: MediaAssetState.RETIRED } },
      select: { id: true, ref: true, state: true },
    });
  }

  /**
   * The ids behind a set of stored-file refs, for linking gallery rows on write (trd D1). Only
   * ready photographs link — a pending one has no confirmed object yet, and the backfill catches
   * up later — while a video links from confirm on, so a gallery saved during the transcode
   * still names its asset (video-hosting spec R3).
   */
  async idsByRefs(refs: string[], db: MediaDb = prisma): Promise<Map<string, string>> {
    if (refs.length === 0) return new Map();
    const rows = await db.mediaAsset.findMany({
      where: {
        ref: { in: refs },
        OR: [
          { kind: MediaAssetKind.IMAGE, state: MediaAssetState.READY },
          { kind: MediaAssetKind.VIDEO, state: { in: [MediaAssetState.READY, MediaAssetState.PROCESSING] } },
        ],
      },
      select: { id: true, ref: true },
    });
    return new Map(rows.map((row) => [row.ref, row.id]));
  }

  /**
   * The asset already holding these bytes for this org, if any (media-library D11). Scoped by
   * org on purpose: another org's identical file is not this org's asset. A video still being
   * transcoded counts — the same clip sent twice in a minute is one video (video-hosting D6) —
   * while a failed one does not, so a retry after a failure gets a fresh attempt.
   */
  async findReadyByHash(orgId: string | null, contentHash: string, db: MediaDb = prisma) {
    return await db.mediaAsset.findFirst({
      where: { orgId, contentHash, state: { in: [MediaAssetState.READY, MediaAssetState.PROCESSING] } },
      select: { id: true, ref: true, width: true, height: true },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Ready images the backfill still has to hash — those recorded before the column existed. */
  async listWithoutHash(limit: number, db: MediaDb = prisma) {
    return await db.mediaAsset.findMany({
      where: { kind: MediaAssetKind.IMAGE, state: MediaAssetState.READY, contentHash: null },
      select: { id: true, ref: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async setHash(id: string, contentHash: string, db: MediaDb = prisma) {
    await db.mediaAsset.update({ where: { id }, data: { contentHash } });
  }

  /** The org's own video references behind a set of ids (spec R5a). Libraries never share, so the org scopes it. */
  async embedIdsByRefs(orgId: string, refs: string[], db: MediaDb = prisma): Promise<Map<string, string>> {
    if (refs.length === 0) return new Map();
    const rows = await db.mediaAsset.findMany({
      where: { orgId, kind: MediaAssetKind.VIDEO_EMBED, ref: { in: refs }, state: MediaAssetState.READY },
      select: { id: true, ref: true },
    });
    return new Map(rows.map((row) => [row.ref, row.id]));
  }

  /** Pending rows older than the cutoff: candidates for the sweep, with what they were about to be. */
  async findStalePending(before: Date, db: MediaDb = prisma) {
    return await db.mediaAsset.findMany({
      where: { state: MediaAssetState.PENDING, createdAt: { lt: before } },
      select: { id: true, ref: true, objectKey: true },
    });
  }

  async deletePending(ids: string[], db: MediaDb = prisma) {
    if (ids.length === 0) return 0;
    const result = await db.mediaAsset.deleteMany({
      where: { id: { in: ids }, state: MediaAssetState.PENDING },
    });
    return result.count;
  }

  /** Which of these refs something still points at — the sweep's safety net (trd D2). */
  async referencedRefs(refs: string[]): Promise<Set<string>> {
    if (refs.length === 0) return new Set();
    const inRefs = { in: refs } satisfies Prisma.StringFilter;
    const [media, categories, profiles, orgBanners, banners] = await Promise.all([
      prisma.productMedia.findMany({ where: { ref: inRefs }, select: { ref: true } }),
      prisma.category.findMany({ where: { heroImage: inRefs }, select: { heroImage: true } }),
      prisma.orgProfile.findMany({
        where: { OR: [{ logoUrl: inRefs }, { heroUrl: inRefs }] },
        select: { logoUrl: true, heroUrl: true },
      }),
      prisma.orgBanner.findMany({ where: { imageUrl: inRefs }, select: { imageUrl: true } }),
      prisma.banner.findMany({ where: { imageUrl: inRefs }, select: { imageUrl: true } }),
    ]);
    const used = new Set<string>();
    media.forEach((r) => used.add(r.ref));
    categories.forEach((r) => used.add(r.heroImage));
    profiles.forEach((r) => {
      if (r.logoUrl) used.add(r.logoUrl);
      if (r.heroUrl) used.add(r.heroUrl);
    });
    orgBanners.forEach((r) => r.imageUrl && used.add(r.imageUrl));
    banners.forEach((r) => r.imageUrl && used.add(r.imageUrl));
    return used;
  }

  /** One page of an org's library with each asset's reference count, newest first (spec R6, trd D7). */
  async listForOrg(orgId: string, filters: MediaLibraryFilters): Promise<{ rows: MediaAssetRow[]; total: number }> {
    const where = libraryWhere(orgId, filters);
    const [rows, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        select: LIBRARY_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * MEDIA_LIBRARY_PAGE_SIZE,
        take: MEDIA_LIBRARY_PAGE_SIZE,
      }),
      prisma.mediaAsset.count({ where }),
    ]);
    return { rows, total };
  }

  async findForOrg(orgId: string, id: string): Promise<MediaAssetRow | null> {
    return await prisma.mediaAsset.findFirst({ where: { id, orgId }, select: LIBRARY_SELECT });
  }

  /** Where an asset is used, named for the org: a query over the referencing relations, never a counter (trd D7). */
  async usesOf(id: string): Promise<MediaUseDto[]> {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id },
      select: {
        productMedia: { select: { slot: true, product: { select: { id: true, name: true } } } },
        categoryHeroes: { select: { id: true, name: true } },
        profileLogos: { select: { orgId: true } },
        profileHeroes: { select: { orgId: true } },
        orgBanners: { select: { id: true, title: true } },
        banners: { select: { id: true, title: true } },
        derivatives: { select: { id: true, source: true } },
        postersFor: { select: { id: true } },
      },
    });
    if (!asset) return [];
    return [
      ...asset.productMedia.map((row) => ({ kind: "product" as const, id: row.product.id, label: row.product.name, slot: row.slot })),
      ...asset.categoryHeroes.map((row) => ({ kind: "category" as const, id: row.id, label: row.name, slot: null })),
      ...asset.profileLogos.map((row) => ({ kind: "storefront-logo" as const, id: row.orgId, label: "Storefront logo", slot: null })),
      ...asset.profileHeroes.map((row) => ({ kind: "storefront-hero" as const, id: row.orgId, label: "Storefront hero", slot: null })),
      ...asset.orgBanners.map((row) => ({ kind: "storefront-banner" as const, id: row.id, label: row.title ?? "Storefront banner", slot: null })),
      ...asset.banners.map((row) => ({ kind: "home-banner" as const, id: row.id, label: row.title ?? "Home banner", slot: null })),
      ...asset.derivatives.map((row) => ({ kind: "derived" as const, id: row.id, label: `${row.source.toLowerCase()} copy`, slot: null })),
      ...asset.postersFor.map((row) => ({ kind: "video-poster" as const, id: row.id, label: "Video poster", slot: null })),
    ];
  }

  /**
   * The photograph that stands in for a video, or null to go back to the worker's frame (spec R8),
   * in one conditional statement: the row moves only if it is this org's hosted video. Whether the
   * photograph may be chosen — this org's, ready, a photograph — is the service's check before this.
   */
  async setPoster(orgId: string, videoId: string, posterAssetId: string | null): Promise<boolean> {
    const result = await prisma.mediaAsset.updateMany({
      where: { id: videoId, orgId, kind: MediaAssetKind.VIDEO, state: { not: MediaAssetState.RETIRED } },
      data: { posterAssetId },
    });
    return result.count === 1;
  }

  /**
   * Retire in one conditional statement (spec R7): the row moves only if it is this org's, ready,
   * and nothing points at it. A read-then-write would let a reference land between the two.
   */
  async retireUnused(orgId: string, id: string, now: Date = new Date()): Promise<boolean> {
    const result = await prisma.mediaAsset.updateMany({
      // A failed video is retired the same way (spec R7): it is in the library, and this is how it leaves.
      where: { id, orgId, state: { in: [MediaAssetState.READY, MediaAssetState.FAILED] }, ...UNREFERENCED },
      data: { state: MediaAssetState.RETIRED, retiredAt: now },
    });
    return result.count === 1;
  }

  /** Retired before the cutoff and still holding an object: candidates for deletion (R7's grace period). */
  async findStaleRetired(before: Date) {
    return await prisma.mediaAsset.findMany({
      where: { state: MediaAssetState.RETIRED, retiredAt: { lt: before }, objectKey: { not: null } },
      select: { id: true, ref: true, objectKey: true },
    });
  }

  /** The object is gone; the record stays, saying so (ADR-0032). */
  async clearObject(id: string): Promise<void> {
    await prisma.mediaAsset.update({ where: { id }, data: { objectKey: null } });
  }
}

export const mediaAssetRepository = new MediaAssetRepository();
