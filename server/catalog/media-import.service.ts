import { DomainError } from "@server/shared/domain-error";
import { sha256Hex } from "@server/shared/hash";

import { buildImagePath } from "./image-paths";
import { normalizeImage } from "./image-upload";
import { mediaAssetRepository } from "./media-asset.repository";
import { mediaAssetService } from "./media-asset.service";
import { putObject } from "./object-store";
import { orgRepository } from "./org.repository";

/**
 * A photo copied from elsewhere into the shop's library (product-merge D6): downloaded, normalised
 * as an upload is, stored in our object store (ADR-0028) and recorded, once per content hash.
 * The caller decides which hosts it trusts; this takes only https and only images, within limits.
 */

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 15 * 1024 * 1024;

/** A copy that failed for a reason the shop can act on by trying again or adding a photo. */
export class PhotoImportError extends DomainError {
  constructor() {
    super("Couldn't copy that photo.", { status: 502 });
    this.name = "PhotoImportError";
  }
}

async function download(url: string): Promise<Buffer> {
  if (!url.startsWith("https://")) throw new PhotoImportError();
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "error", cache: "no-store" });
  } catch {
    throw new PhotoImportError();
  }
  const type = response.headers.get("content-type") ?? "";
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (!response.ok || !type.startsWith("image/") || declared > MAX_BYTES) throw new PhotoImportError();
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new PhotoImportError();
  return bytes;
}

export const mediaImportService = {
  /** The stored URL of the copy, an existing one when the shop already has the same photo. */
  async fromUrl(orgId: string, uploaderId: string | null, url: string): Promise<string> {
    const raw = await download(url);
    const image = await normalizeImage(new File([new Uint8Array(raw)], "marketplace-photo", { type: "image/jpeg" })).catch(() => {
      throw new PhotoImportError();
    });
    const hash = sha256Hex(image.body);
    const existing = await mediaAssetRepository.findReadyByHash(orgId, hash);
    if (existing) return existing.ref;
    const [org] = await orgRepository.findSummaries([orgId]);
    const path = buildImagePath("org", `marketplace-photo.${image.extension}`, "marketplace", org?.code ?? orgId);
    await putObject(path, image.body, image.contentType);
    const asset = await mediaAssetService.recordServerUpload({
      orgId,
      uploaderId,
      pathname: path,
      contentType: image.contentType,
      bytes: image.body.byteLength,
      width: image.width,
      height: image.height,
      contentHash: hash,
    });
    return asset.ref;
  },
};
