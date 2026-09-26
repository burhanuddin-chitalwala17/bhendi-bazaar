import sharp from "sharp";
import { DomainError, ForbiddenError, NotFoundError } from "@server/shared/domain-error";
import { MediaAssetState } from "@prisma/client";
import { deleteObject, getObject, headObject, presignUpload, publicUrlFor } from "@server/catalog/object-store";
import { mediaAssetRepository } from "@server/catalog/media-asset.repository";

/** Older than this, a pending row is an upload that never confirmed (trd D2). */
export const PENDING_UPLOAD_TTL_MS = 60 * 60 * 1000;
/** Nothing we store is larger; a claimed dimension beyond it is a lie, not a picture. */
const MAX_DIMENSION = 20_000;

export interface BeginUploadInput {
  orgId: string | null;
  uploaderId: string | null;
  pathname: string;
  contentType: string;
  size: number;
}

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
   * no image can be stored without a record. The browser gets the id back with the URL.
   */
  async beginUpload(input: BeginUploadInput) {
    const signed = await presignUpload(input.pathname, input.contentType, input.size);
    const asset = await mediaAssetRepository.createPending({
      orgId: input.orgId,
      uploaderId: input.uploaderId,
      ref: signed.publicUrl,
      objectKey: input.pathname,
      mimeType: input.contentType,
      bytes: input.size,
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
};
