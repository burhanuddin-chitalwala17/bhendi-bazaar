import sharp from "sharp";
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from "@server/shared/domain-error";
import { MediaAssetSource, MediaAssetState } from "@prisma/client";
import { deleteObject, getObject, headObject, presignUpload, publicUrlFor } from "@server/catalog/object-store";
import { mediaAssetRepository } from "@server/catalog/media-asset.repository";
import {
  MEDIA_LIBRARY_PAGE_SIZE,
  describeUses,
  toMediaAssetDto,
  type MediaAssetDetailDto,
  type MediaAssetDto,
} from "@server/catalog/media-library.types";
import type { MediaLibraryFilters } from "@/lib/validation/schemas/media-library.schema";
import type { DerivedFromInput } from "@/lib/validation/schemas/upload.schema";
import type { Pagination } from "@server/shared/pagination";

/** Older than this, a pending row is an upload that never confirmed (trd D2). */
export const PENDING_UPLOAD_TTL_MS = 60 * 60 * 1000;
/** A retired image's object is kept this long, so a retirement in error costs nothing (spec R7). */
export const RETIRED_OBJECT_GRACE_MS = 30 * 24 * 60 * 60 * 1000;
/** Nothing we store is larger; a claimed dimension beyond it is a lie, not a picture. */
const MAX_DIMENSION = 20_000;

export interface BeginUploadInput {
  orgId: string | null;
  uploaderId: string | null;
  pathname: string;
  contentType: string;
  size: number;
  /** SHA-256 hex of the bytes about to be sent, when the browser could compute it. */
  contentHash?: string | null;
  /** These bytes are a crop of an asset the caller owns; the record is DERIVED from it (trd D6a). */
  derivedFrom?: DerivedFromInput | null;
}

/** The token route's answer: permission to upload, or the asset that already holds these bytes. */
export type BeginUploadResult =
  | { uploadUrl: string; publicUrl: string; assetId: string; duplicate?: undefined }
  | { duplicate: { assetId: string; ref: string; width: number | null; height: number | null } };

export interface ConfirmUploadInput {
  assetId: string;
  /** Who is confirming: an org member scopes to that org, platform admin to platform-owned. */
  orgId: string | null;
  width?: number;
  height?: number;
}

function validDimension(value: number | undefined): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_DIMENSION;
}

export const mediaAssetService = {
  /**
   * Register, then sign (media-library R1, trd D2): the row exists before the bytes move, so
   * no image can be stored without a record. The browser gets the id back with the URL — or,
   * when this org already holds these exact bytes, that asset instead of a second copy (D11).
   */
  async beginUpload(input: BeginUploadInput): Promise<BeginUploadResult> {
    // A derivation names its source before anything else (trd D6a): it must be this owner's and
    // ready, or there is nothing to derive from. Another org's image is "not found", not a hint.
    const source = input.derivedFrom
      ? await mediaAssetRepository.findReadySource(input.orgId, input.derivedFrom.assetId)
      : null;
    if (input.derivedFrom && !source) throw new NotFoundError("Source image not found");

    // D11 applies to the bytes being sent, so a crop is matched against earlier crops, never its
    // source — the bytes differ.
    const contentHash = input.contentHash ?? null;
    if (contentHash) {
      const existing = await mediaAssetRepository.findReadyByHash(input.orgId, contentHash);
      if (existing) {
        return { duplicate: { assetId: existing.id, ref: existing.ref, width: existing.width, height: existing.height } };
      }
    }
    const signed = await presignUpload(input.pathname, input.contentType, input.size);
    const asset = await mediaAssetRepository.createPending({
      orgId: input.orgId,
      uploaderId: input.uploaderId,
      ref: signed.publicUrl,
      objectKey: input.pathname,
      mimeType: input.contentType,
      bytes: input.size,
      contentHash,
      ...(source && input.derivedFrom
        ? { source: MediaAssetSource.DERIVED, derivedFromId: source.id, transform: input.derivedFrom.transform }
        : {}),
    });
    return { ...signed, assetId: asset.id };
  },

  /**
   * The bytes landed; make the record true. The store is asked what it actually holds, and the
   * dimensions come from the browser's canvas or, failing that, from the object itself, so a
   * ready asset always has them (R1). A second confirm of a ready asset is a no-op.
   */
  async confirmUpload(input: ConfirmUploadInput) {
    const asset = await mediaAssetRepository.findById(input.assetId);
    if (!asset) throw new NotFoundError("Upload not found");
    if (asset.orgId !== input.orgId) throw new ForbiddenError("That upload belongs to someone else");
    if (asset.state === MediaAssetState.READY) return { assetId: asset.id, ref: asset.ref, alreadyReady: true };
    if (asset.state !== MediaAssetState.PENDING || !asset.objectKey) {
      throw new DomainError("This upload can no longer be confirmed");
    }

    const stored = await headObject(asset.objectKey);
    if (!stored) throw new DomainError("The image has not reached the store yet. Try again in a moment.");

    let { width, height } = input;
    if (!validDimension(width) || !validDimension(height)) {
      const bytes = await getObject(asset.objectKey);
      const meta = await sharp(bytes).metadata();
      if (!meta.width || !meta.height) throw new DomainError("Could not read the image's dimensions");
      width = meta.width;
      height = meta.height;
    }

    const confirmed = await mediaAssetRepository.confirm(asset.id, {
      width,
      height,
      bytes: stored.contentLength,
      mimeType: stored.contentType,
    });
    return { assetId: asset.id, ref: asset.ref, alreadyReady: !confirmed };
  },

  /** The server-side path already has the bytes and their dimensions; the record is born ready. */
  async recordServerUpload(input: {
    orgId: string | null;
    uploaderId: string | null;
    pathname: string;
    contentType: string;
    bytes: number;
    width: number;
    height: number;
    contentHash?: string | null;
  }) {
    return await mediaAssetRepository.createReady({
      orgId: input.orgId,
      uploaderId: input.uploaderId,
      ref: publicUrlFor(input.pathname),
      objectKey: input.pathname,
      mimeType: input.contentType,
      bytes: input.bytes,
      width: input.width,
      height: input.height,
      contentHash: input.contentHash ?? null,
    });
  },

  /**
   * Pending rows past the TTL never confirmed. Their objects, if the PUT happened, go too —
   * unless something already references the URL, in which case the row is left for the
   * backfill to repair rather than pulling an image out from under a product (trd D2).
   */
  async sweepPendingUploads(now: Date = new Date()) {
    const stale = await mediaAssetRepository.findStalePending(new Date(now.getTime() - PENDING_UPLOAD_TTL_MS));
    if (stale.length === 0) return { removed: 0, kept: 0 };
    const referenced = await mediaAssetRepository.referencedRefs(stale.map((row) => row.ref));
    const doomed = stale.filter((row) => !referenced.has(row.ref));
    for (const row of doomed) {
      if (row.objectKey) await deleteObject(publicUrlFor(row.objectKey));
    }
    const removed = await mediaAssetRepository.deletePending(doomed.map((row) => row.id));
    return { removed, kept: stale.length - doomed.length };
  },

  /** One page of an org's library, filtered (spec R6). */
  async listLibrary(orgId: string, filters: MediaLibraryFilters): Promise<{ assets: MediaAssetDto[]; pagination: Pagination }> {
    const { rows, total } = await mediaAssetRepository.listForOrg(orgId, filters);
    return {
      assets: rows.map(toMediaAssetDto),
      pagination: {
        page: filters.page,
        limit: MEDIA_LIBRARY_PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / MEDIA_LIBRARY_PAGE_SIZE)),
      },
    };
  },

  /** An asset and every place it is used, for the library's detail sheet (spec R6). */
  async assetDetail(orgId: string, id: string): Promise<MediaAssetDetailDto> {
    const row = await mediaAssetRepository.findForOrg(orgId, id);
    if (!row) throw new NotFoundError("Image not found");
    return { asset: toMediaAssetDto(row), uses: await mediaAssetRepository.usesOf(id) };
  },

  /**
   * Retire an image nothing uses (spec R7, A3). The state change is one conditional statement;
   * when it moves nothing, the uses are read only to say *why* — the refusal itself did not
   * depend on that read. A URL still written on a row that has no asset link counts as a use too.
   */
  async retire(orgId: string, id: string, now: Date = new Date()): Promise<MediaAssetDto> {
    const row = await mediaAssetRepository.findForOrg(orgId, id);
    if (!row) throw new NotFoundError("Image not found");
    if (row.state === MediaAssetState.RETIRED) return toMediaAssetDto(row);

    const byUrl = await mediaAssetRepository.referencedRefs([row.ref]);
    const retired = byUrl.has(row.ref) ? false : await mediaAssetRepository.retireUnused(orgId, id, now);
    if (!retired) {
      const uses = await mediaAssetRepository.usesOf(id);
      const where = uses.length ? describeUses(uses) : "a page that still shows it";
      throw new ConflictError(`This image is still used by ${where}. Remove it there first.`);
    }
    const after = await mediaAssetRepository.findForOrg(orgId, id);
    return toMediaAssetDto(after ?? { ...row, state: MediaAssetState.RETIRED, retiredAt: now });
  },

  /**
   * Retired past the grace period, the stored object goes and the record stays (R7, ADR-0032) —
   * unless a URL somewhere still shows it, in which case the object is kept and the row waits.
   */
  async sweepRetiredObjects(now: Date = new Date()) {
    const stale = await mediaAssetRepository.findStaleRetired(new Date(now.getTime() - RETIRED_OBJECT_GRACE_MS));
    if (stale.length === 0) return { deleted: 0, kept: 0 };
    const referenced = await mediaAssetRepository.referencedRefs(stale.map((row) => row.ref));
    let deleted = 0;
    for (const row of stale) {
      if (referenced.has(row.ref) || !row.objectKey) continue;
      await deleteObject(publicUrlFor(row.objectKey));
      await mediaAssetRepository.clearObject(row.id);
      deleted += 1;
    }
    return { deleted, kept: stale.length - deleted };
  },

  /** Both sweeps, as the worker runs them (media.jobs.ts). */
  async sweep(now: Date = new Date()) {
    const pending = await this.sweepPendingUploads(now);
    const retired = await this.sweepRetiredObjects(now);
    return { pending, retired };
  },
};
