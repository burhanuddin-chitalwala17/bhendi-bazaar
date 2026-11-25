/** Downloading a library item's original (viewer spec R5–R7, trd D1–D3). */

import { MediaAssetKind, MediaAssetState } from "@prisma/client";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
import { mediaAssetRepository } from "@server/catalog/media-asset.repository";
import { orgRepository } from "@server/catalog/org.repository";
import { presignDownload } from "@server/catalog/object-store";

export const DOWNLOAD_FILE_GONE = "This file was deleted thirty days after it was retired.";
export const DOWNLOAD_NO_FILE_FOR_YOUTUBE = "This video lives on YouTube, so there's no file to download.";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/**
 * `<shop code>-<asset id>.<ext>`. Codes are ASCII by construction; the strip still holds the
 * disposition header to a value that needs no quoting or RFC 5987 encoding if one ever is not.
 */
export function downloadFilename(orgCode: string, assetId: string, mimeType: string | null): string {
  const ext = (mimeType && EXTENSIONS[mimeType]) || "bin";
  return `${orgCode}-${assetId}.${ext}`.replace(/[^A-Za-z0-9._-]/g, "-");
}

/**
 * A link that saves this org's item under its download name. Another org's item, or an upload
 * never confirmed, is "not found" rather than a hint that it exists (spec R7).
 */
export async function downloadLink(orgId: string, id: string): Promise<string> {
  const asset = await mediaAssetRepository.findById(id);
  if (!asset || asset.orgId !== orgId || asset.state === MediaAssetState.PENDING) throw new NotFoundError("File not found");
  if (asset.kind === MediaAssetKind.VIDEO_EMBED) throw new DomainError(DOWNLOAD_NO_FILE_FOR_YOUTUBE, { status: 422 });
  // Swept after the retirement grace (Q10), or never stored.
  if (!asset.objectKey) throw new DomainError(DOWNLOAD_FILE_GONE, { status: 410 });
  const org = await orgRepository.findSummary(orgId);
  if (!org) throw new NotFoundError("File not found");
  return await presignDownload(asset.objectKey, downloadFilename(org.code, asset.id, asset.mimeType));
}
