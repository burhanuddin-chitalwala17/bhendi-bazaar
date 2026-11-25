/** Acting on many library items at once (bulk-actions spec R3–R8, trd D1–D4). */

import { MediaAssetKind, MediaAssetState } from "@prisma/client";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { mediaAssetRepository } from "@server/catalog/media-asset.repository";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { orgRepository } from "@server/catalog/org.repository";
import { presignDownload } from "@server/catalog/object-store";
import { downloadFilename } from "@server/catalog/media-download";
import {
  NO_FILE_REASON,
  type MediaBulkRetireOutcome,
  type MediaBulkTagOutcome,
  type MediaDownloadLinksDto,
  type MediaTag,
} from "@server/catalog/media-library.types";

/** The most one zip may hold (Q4): the phone builds it in memory. */
export const ZIP_LIMIT_BYTES = 500 * 1024 * 1024;
export const ZIP_TOO_LARGE = "That's more than can be downloaded at once. Select fewer and download in two goes.";
const BULK_LINK_TTL_SECONDS = 15 * 60;

/** Every lookup is scoped to the org, so another shop's id reads as unknown (R8). */
async function rowsById(orgId: string, ids: string[]) {
  const rows = await mediaAssetRepository.findManyForOrg(orgId, ids);
  return new Map(rows.map((row) => [row.id, row]));
}

export const mediaBulkService = {
  /**
   * The one-asset retire, once per id (D2), so each keeps its own conditional write, by-URL check and
   * rendition retirement; a use added since the grid loaded refuses only that one.
   */
  async retireMany(orgId: string, ids: string[], now: Date = new Date()): Promise<MediaBulkRetireOutcome> {
    const rows = await rowsById(orgId, ids);
    const outcome: MediaBulkRetireOutcome = { retired: [], inUse: [], alreadyRetired: [], notFound: [] };
    for (const id of ids) {
      const row = rows.get(id);
      if (!row) outcome.notFound.push(id);
      else if (row.state === MediaAssetState.RETIRED) outcome.alreadyRetired.push(id);
      else {
        try {
          await mediaAssetService.retire(orgId, id, now);
          outcome.retired.push(id);
        } catch (error) {
          if (error instanceof ConflictError) outcome.inUse.push(id);
          else if (error instanceof NotFoundError) outcome.notFound.push(id);
          else throw error;
        }
      }
    }
    return outcome;
  },

  /** Add is one statement; remove is the per-photo compare-and-set (D3). Videos, links and retired photos are left out. */
  async setTagMany(orgId: string, ids: string[], tag: MediaTag, on: boolean): Promise<MediaBulkTagOutcome> {
    const rows = await rowsById(orgId, ids);
    const outcome: MediaBulkTagOutcome = { changed: [], notPhoto: [], retired: [], notFound: [] };
    const photos: string[] = [];
    for (const id of ids) {
      const row = rows.get(id);
      if (!row) outcome.notFound.push(id);
      else if (row.kind !== MediaAssetKind.IMAGE) outcome.notPhoto.push(id);
      else if (row.state === MediaAssetState.RETIRED) outcome.retired.push(id);
      else photos.push(id);
    }
    if (on) {
      await mediaAssetRepository.addTag(photos, tag, orgId);
      outcome.changed.push(...photos);
      return outcome;
    }
    for (const id of photos) {
      // False: retired between the read and the write.
      if (await mediaAssetRepository.setTag(orgId, id, tag, false)) outcome.changed.push(id);
      else outcome.retired.push(id);
    }
    return outcome;
  },

  /** Presigned links for the browser's zip, refused above the limit before anything is signed (D4). */
  async downloadLinks(orgId: string, ids: string[]): Promise<MediaDownloadLinksDto> {
    const rows = await rowsById(orgId, ids);
    const stored = [];
    const noFile: MediaDownloadLinksDto["noFile"] = [];
    for (const id of ids) {
      const row = rows.get(id);
      if (!row) continue;
      if (row.kind === MediaAssetKind.VIDEO_EMBED) noFile.push({ id, reason: NO_FILE_REASON.LINK });
      else if (!row.objectKey) noFile.push({ id, reason: NO_FILE_REASON.DELETED });
      else stored.push({ ...row, objectKey: row.objectKey });
    }
    // A legacy row with no size counts as 0; the client checks real lengths as it streams.
    const totalBytes = stored.reduce((sum, row) => sum + (row.bytes ?? 0), 0);
    if (totalBytes > ZIP_LIMIT_BYTES) {
      throw new DomainError(ZIP_TOO_LARGE, {
        status: 422,
        details: [
          { path: "totalBytes", message: String(totalBytes) },
          { path: "limitBytes", message: String(ZIP_LIMIT_BYTES) },
        ],
      });
    }
    if (!stored.length) return { files: [], noFile, totalBytes };
    const org = await orgRepository.findSummary(orgId);
    if (!org) throw new NotFoundError("Shop not found");
    const files = await Promise.all(
      stored.map(async (row) => {
        const filename = downloadFilename(org.code, row.id, row.mimeType);
        const url = await presignDownload(row.objectKey, filename, BULK_LINK_TTL_SECONDS);
        return { id: row.id, url, filename, bytes: row.bytes };
      }),
    );
    return { files, noFile, totalBytes };
  },
};
