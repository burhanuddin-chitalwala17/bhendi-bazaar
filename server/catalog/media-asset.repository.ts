import { prisma } from "@server/shared/prisma";
import { MediaAssetKind, MediaAssetSource, MediaAssetState, type Prisma } from "@prisma/client";

/** A Prisma client or the transaction client a caller is already inside. */
export type MediaDb = Pick<typeof prisma, "mediaAsset">;

export interface PendingAssetInput {
  orgId: string | null;
  uploaderId: string | null;
  ref: string;
  objectKey: string;
  mimeType: string;
  bytes: number;
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
}

export interface ConfirmedDimensions {
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
}

/**
 * The one reader and writer of `MediaAsset` (ADR-0003, media-library trd D1). Rows are
 * created pending at presign and confirmed after the bytes land (D2); the backfill and the
 * server upload path create them ready. Nothing here deletes a ready asset — retirement is
 * a state (R7) — and only stale pending rows, which never had a confirmed object, go.
 */
export class MediaAssetRepository {
  async createPending(input: PendingAssetInput, db: MediaDb = prisma) {
    return await db.mediaAsset.create({
      data: {
        kind: MediaAssetKind.IMAGE,
        source: MediaAssetSource.UPLOAD,
        state: MediaAssetState.PENDING,
        ...input,
      },
      select: { id: true, ref: true },
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

  async createReady(input: ReadyAssetInput, db: MediaDb = prisma) {
    return await db.mediaAsset.create({
      data: {
        kind: MediaAssetKind.IMAGE,
        source: MediaAssetSource.UPLOAD,
        state: MediaAssetState.READY,
        ...input,
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
   * The ids behind a set of image refs, for linking gallery rows on write (trd D1). Only ready
   * assets link: a pending one has no confirmed object yet, and the backfill catches up later.
   */
  async idsByRefs(refs: string[], db: MediaDb = prisma): Promise<Map<string, string>> {
    if (refs.length === 0) return new Map();
    const rows = await db.mediaAsset.findMany({
      where: { kind: MediaAssetKind.IMAGE, ref: { in: refs }, state: MediaAssetState.READY },
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
}

export const mediaAssetRepository = new MediaAssetRepository();
