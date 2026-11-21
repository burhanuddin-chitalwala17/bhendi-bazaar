import sharp from "sharp";
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from "@server/shared/domain-error";
import { MediaAssetKind, MediaAssetSource, MediaAssetState, type Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs";
import { deleteObject, ensureWidthCopies, getObject, headObject, presignUpload, publicBaseUrl, publicUrlFor, putObject } from "@server/catalog/object-store";
import { sha256Hex } from "@server/shared/hash";
import { mediaAssetRepository } from "@server/catalog/media-asset.repository";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { isVideoContentType } from "@server/catalog/video";
import { IMAGE_QUALITY, MAX_IMAGE_EDGE } from "@server/catalog/media";
import { videoTranscodeSpec } from "@server/catalog/video.job";
import {
  MEDIA_LIBRARY_PAGE_SIZE,
  describeUses,
  toMediaAssetDto,
  type MediaTag,
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

/** The confirm route's answer: READY for a photograph, PROCESSING for a video until the worker is done. */
export interface ConfirmUploadResult {
  assetId: string;
  ref: string;
  state: MediaAssetState;
  /** This confirm moved nothing: the asset had already left PENDING. */
  alreadyReady: boolean;
}

function validDimension(value: number | undefined): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_DIMENSION;
}

/** A picture may only be derived from one of this org's own stored photographs. */
async function assertDerivableSource(orgId: string, sourceAssetId: string) {
  const source = await mediaAssetRepository.findById(sourceAssetId);
  if (!source || source.orgId !== orgId || source.kind !== MediaAssetKind.IMAGE || !source.objectKey) {
    throw new NotFoundError("Source image not found");
  }
  // Narrowed for the caller that names the derivative beside it: the check above is what makes
  // this true, and the type should say so rather than each caller asserting it again.
  return { ...source, objectKey: source.objectKey };
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
      // The schema has already bounded the size by kind; the record says which kind it was for.
      kind: isVideoContentType(input.contentType) ? MediaAssetKind.VIDEO : MediaAssetKind.IMAGE,
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
   *
   * A video is different in one way (video-hosting trd D2): it becomes PROCESSING, and the
   * transcode is enqueued in the same transaction as that state change, so neither can exist
   * without the other. Its dimensions and duration are the worker's to read.
   */
  async confirmUpload(input: ConfirmUploadInput): Promise<ConfirmUploadResult> {
    const asset = await mediaAssetRepository.findById(input.assetId);
    if (!asset) throw new NotFoundError("Upload not found");
    if (asset.orgId !== input.orgId) throw new ForbiddenError("That upload belongs to someone else");
    if (asset.state === MediaAssetState.READY || asset.state === MediaAssetState.PROCESSING) {
      return { assetId: asset.id, ref: asset.ref, state: asset.state, alreadyReady: true };
    }
    if (asset.state !== MediaAssetState.PENDING || !asset.objectKey) {
      throw new DomainError("This upload can no longer be confirmed");
    }

    const stored = await headObject(asset.objectKey);
    if (!stored) throw new DomainError("The file has not reached the store yet. Try again in a moment.");

    if (asset.kind === MediaAssetKind.VIDEO) {
      const started = await prisma.$transaction(async (tx) => {
        const moved = await mediaAssetRepository.startProcessing(
          asset.id,
          { bytes: stored.contentLength, mimeType: stored.contentType },
          tx,
        );
        if (moved) await enqueue(tx, videoTranscodeSpec, { assetId: asset.id, orgId: asset.orgId });
        return moved;
      });
      return { assetId: asset.id, ref: asset.ref, state: MediaAssetState.PROCESSING, alreadyReady: !started };
    }

    let { width, height } = input;
    if (!validDimension(width) || !validDimension(height)) {
      const bytes = await getObject(asset.objectKey);
      const meta = await sharp(bytes).metadata();
      if (!meta.width || !meta.height) throw new DomainError("Could not read the image's dimensions");
      width = meta.width;
      height = meta.height;
    }

    // The browser PUT the original only. Before the record is usable, the copies the image loader
    // will ask for must exist, or the first page to show it renders a broken image (ADR-0075).
    await ensureWidthCopies(asset.objectKey);

    const confirmed = await mediaAssetRepository.confirm(asset.id, {
      width,
      height,
      bytes: stored.contentLength,
      mimeType: stored.contentType,
    });
    return { assetId: asset.id, ref: asset.ref, state: MediaAssetState.READY, alreadyReady: !confirmed };
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

  /** Switch one tag on one of the org's images (ai-images/media-tags R6); another org's is "not found". */
  async setTag(orgId: string, id: string, tag: MediaTag, on: boolean): Promise<MediaAssetDto> {
    if (!(await mediaAssetRepository.setTag(orgId, id, tag, on))) throw new NotFoundError("Image not found");
    const after = await mediaAssetRepository.findForOrg(orgId, id);
    if (!after) throw new NotFoundError("Image not found");
    return toMediaAssetDto(after);
  },

  /**
   * The photograph that stands in for a hosted video, or null for the worker's own frame
   * (video-hosting spec R8). The photograph is checked before the write, and another org's — or
   * one not ready, or not a photograph — is "not found" rather than a hint that it exists.
   */
  async replacePoster(orgId: string, videoId: string, posterAssetId: string | null): Promise<MediaAssetDto> {
    if (posterAssetId !== null) {
      const photo = await mediaAssetRepository.findForOrg(orgId, posterAssetId);
      if (!photo || photo.kind !== MediaAssetKind.IMAGE || photo.state !== MediaAssetState.READY) {
        throw new NotFoundError("Photo not found");
      }
    }
    const moved = await mediaAssetRepository.setPoster(orgId, videoId, posterAssetId);
    if (!moved) throw new NotFoundError("Video not found");
    const after = await mediaAssetRepository.findForOrg(orgId, videoId);
    if (!after) throw new NotFoundError("Video not found");
    return toMediaAssetDto(after);
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
    // A rendition exists only to serve a surface from this source, so it goes when the source
    // does (renditions D5, R6). A crop or an improvement is a picture the shop made and stays.
    await mediaAssetRepository.retireRenditionsOf(id, now);

    const after = await mediaAssetRepository.findForOrg(orgId, id);
    return toMediaAssetDto(after ?? { ...row, state: MediaAssetState.RETIRED, retiredAt: now });
  },

  /**
   * The rendition of a source at a surface, or null (renditions D2).
   *
   * Catalog owns the asset table, so content asks through here rather than reaching the
   * repository ([ADR-0033](../../docs/adr/0033-a-domain-is-reached-through-its-public-surface.md)).
   */
  async findRendition(sourceAssetId: string, surface: string) {
    return await mediaAssetRepository.findRendition(sourceAssetId, surface);
  },

  /** The stored image behind a URL, for a caller that holds the URL and needs the asset. */
  async findImageByRef(ref: string) {
    return await mediaAssetRepository.findByRef(MediaAssetKind.IMAGE, ref);
  },

  /** What a renderer needs to decide where to render from: this picture's size and its parent. */
  async describeForRendition(assetId: string) {
    const asset = await mediaAssetRepository.findById(assetId);
    if (!asset) return null;
    return { width: asset.width, height: asset.height, derivedFromId: asset.derivedFromId };
  },

  /**
   * The platform's own listing: every library, or one chosen from them (spec R12, trd D10).
   *
   * The same query the org's library runs, so the two cannot come to disagree about what a
   * library holds — the org filter is the only difference, and read-only is enforced by there
   * being no write here to reach.
   */
  async listAnywhere(
    scope: string | null | undefined,
    filters: MediaLibraryFilters,
  ): Promise<{ assets: MediaAssetDto[]; pagination: Pagination }> {
    const { rows, total } = await mediaAssetRepository.listIn(scope, filters);
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

  /**
   * The platform taking an image down over a breach, with the reason recorded (spec R12).
   *
   * Two things are deliberately unlike an org retiring its own picture. It is not refused
   * while the image is in use — a breach comes down now, and the pages that point at it stop
   * pointing at it — and the reason is stored on the asset as well as written to the audit
   * trail, because the org has to be able to read why without an admin to ask
   * ([ADR-0021](../../docs/adr/0021-audit-trail-never-fails-the-action.md): the trail records
   * the action, it never decides whether it happened).
   */
  async retireAsPlatform(
    adminId: string,
    id: string,
    reason: string,
    now: Date = new Date(),
  ): Promise<MediaAssetDto> {
    const row = await mediaAssetRepository.findAnywhere(id);
    if (!row) throw new NotFoundError("Image not found");
    if (row.state === MediaAssetState.RETIRED) return toMediaAssetDto(row);

    const retired = await mediaAssetRepository.retireByPlatform(id, reason, now);
    if (!retired) throw new ConflictError("This image has already been taken down.");

    await recordAdminAction({
      adminId,
      action: "media.retire",
      resource: "MediaAsset",
      resourceId: id,
      metadata: { reason, orgId: row.orgId ?? null, ref: row.ref },
    });

    await mediaAssetRepository.retireRenditionsOf(id, now);

    const after = await mediaAssetRepository.findAnywhere(id);
    return toMediaAssetDto(after ?? row);
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

  /**
   * A ready photograph of this org's that another domain may work from — by its id, or by the URL
   * its gallery row carries (image-enhancement trd D1). Another org's, or one not ready, is null
   * rather than a hint that it exists.
   */
  async findReadyImage(orgId: string, source: { assetId?: string | null; ref?: string | null }) {
    return await mediaAssetRepository.findReadyImage(orgId, source);
  },

  /**
   * The stored bytes of one photograph, for a worker deriving from it — never for serving
   * (ADR-0026). The key comes back beside them because a service asked to work on the picture may
   * want to fetch it for itself rather than be handed an upload (image-enhancement trd D3).
   */
  async readImageBytes(assetId: string): Promise<{ bytes: Buffer; objectKey: string; mimeType: string | null }> {
    const asset = await mediaAssetRepository.findById(assetId);
    if (!asset || asset.kind !== MediaAssetKind.IMAGE || asset.state !== MediaAssetState.READY || !asset.objectKey) {
      throw new NotFoundError("Photo not found");
    }
    return { bytes: await getObject(asset.objectKey), objectKey: asset.objectKey, mimeType: asset.mimeType };
  },

  /**
   * Bytes nobody owns yet — a proposal awaiting a decision — at a key the caller names, with no
   * record: the record comes only if the proposal is kept (image-enhancement trd D1). Returns the
   * public URL, which is how a compare view shows it.
   */
  async putLooseObject(key: string, bytes: Buffer, contentType: string): Promise<string> {
    return await putObject(key, bytes, contentType);
  },

  /** A loose object's bytes, for a retried run replaying what it already paid for (generation-foundation trd D6). */
  async readLooseObject(key: string): Promise<Buffer> {
    return await getObject(key);
  },

  async deleteLooseObject(key: string): Promise<void> {
    await deleteObject(publicUrlFor(key));
  },

  /** Where the browser fetches a stored key from; the one spelling of that outside this domain. */
  publicUrlOf(key: string): string {
    return publicUrlFor(key);
  },

  /**
   * Where stored objects are publicly readable from, with no key. Another domain needs it only to
   * ask *what kind of host* that is — an image host that can transform a picture on delivery is not
   * the same as a bare bucket — which is a question about the store and so is answered here.
   */
  publicBaseUrl(): string {
    return publicBaseUrl();
  },

  /**
   * Adopt bytes made from one of the org's photographs (image-enhancement trd D1): the object at
   * `fromKey` is copied beside its source under `fileSuffix`, measured and hashed, and recorded as
   * a READY DERIVED image carrying the transform that made it. The source is never altered
   * (media-library R3). The same bytes already held by this org are answered with that asset (D11),
   * which is also what makes a repeated acceptance harmless.
   */
  async registerDerivedObject(input: {
    orgId: string;
    uploaderId: string | null;
    sourceAssetId: string;
    fromKey: string;
    /** `<tool>-<id>.webp` — appended to the source's path, minus its extension. */
    fileSuffix: string;
    contentType: string;
    transform: Prisma.InputJsonValue;
  }): Promise<{ id: string; ref: string }> {
    // Whose source it is decides before any bytes move: fetching first would spend a read on a
    // request that was never going to be allowed.
    await assertDerivableSource(input.orgId, input.sourceAssetId);
    return await this.registerDerivedBytes({ ...input, bytes: await getObject(input.fromKey) });
  },

  /**
   * The same adoption for bytes already in hand — a crop made here rather than proposed elsewhere.
   * One tail for both, so a derived image is measured, hashed and recorded exactly one way.
   */
  async registerDerivedBytes(input: {
    orgId: string;
    uploaderId: string | null;
    sourceAssetId: string;
    bytes: Buffer;
    fileSuffix: string;
    contentType: string;
    transform: Prisma.InputJsonValue;
  }): Promise<{ id: string; ref: string }> {
    const source = await assertDerivableSource(input.orgId, input.sourceAssetId);
    const { bytes } = input;
    const contentHash = sha256Hex(bytes);
    const existing = await mediaAssetRepository.findReadyByHash(input.orgId, contentHash);
    if (existing) return { id: existing.id, ref: existing.ref };

    const meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height) throw new DomainError("Could not read the image's dimensions");
    const pathname = `${source.objectKey.replace(/\.[^./]+$/, "")}-${input.fileSuffix}`;
    const ref = await putObject(pathname, bytes, input.contentType);
    return await mediaAssetRepository.createReady({
      orgId: input.orgId,
      uploaderId: input.uploaderId,
      ref,
      objectKey: pathname,
      mimeType: input.contentType,
      bytes: bytes.byteLength,
      width: meta.width,
      height: meta.height,
      contentHash,
      source: MediaAssetSource.DERIVED,
      derivedFromId: source.id,
      transform: input.transform,
    });
  },

  /**
   * Reframe a photograph the org already has (media-library R8a, trd D6a): the source is turned
   * and cut here, where its bytes already are, and the result is a derived image beside it. The
   * source is never altered — a crop is a second picture, not an edit — so a surface that later
   * needs the pixels this one discarded can still reach back to it.
   */
  async cropAsset(
    orgId: string,
    uploaderId: string | null,
    assetId: string,
    transform: { rotation: number; crop: { x: number; y: number; width: number; height: number } },
  ): Promise<MediaAssetDto> {
    const source = await mediaAssetRepository.findForOrg(orgId, assetId);
    if (!source || source.kind !== MediaAssetKind.IMAGE || source.state !== MediaAssetState.READY) {
      throw new NotFoundError("Photo not found");
    }
    const row = await mediaAssetRepository.findById(assetId);
    if (!row?.objectKey) throw new NotFoundError("Photo not found");

    const { crop, rotation } = transform;
    let cut;
    try {
      // Turn first, then cut: the rectangle was measured on the turned picture, which is what the
      // org member was looking at. Capped at the stored ceiling, never enlarged (ADR-0026).
      cut = await sharp(await getObject(row.objectKey))
        .rotate(rotation)
        .extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
        .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: IMAGE_QUALITY })
        .toBuffer();
    } catch {
      // The rectangle was measured against a report of the picture; the picture itself decides.
      throw new DomainError("That frame falls outside the photo. Try again.");
    }

    const derived = await this.registerDerivedBytes({
      orgId,
      uploaderId,
      sourceAssetId: assetId,
      bytes: cut,
      fileSuffix: `crop-${Date.now().toString(36)}.webp`,
      contentType: "image/webp",
      transform: { rotation, crop },
    });
    const made = await mediaAssetRepository.findForOrg(orgId, derived.id);
    if (!made) throw new NotFoundError("Photo not found");
    return toMediaAssetDto(made);
  },

  /** Both sweeps, as the worker runs them (media.jobs.ts). */
  async sweep(now: Date = new Date()) {
    const pending = await this.sweepPendingUploads(now);
    const retired = await this.sweepRetiredObjects(now);
    return { pending, retired };
  },
};
