import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import { IMAGE_QUALITY, MAX_IMAGE_EDGE } from "@server/catalog/media";
import {
  buildImagePath,
  imageFileProblem,
  normalizedName,
  type ImageFolder,
} from "@server/catalog/image-paths";
import { putObject } from "@server/catalog/object-store";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { sha256Hex } from "@server/shared/hash";

/**
 * Server-side catalog image uploads: the bytes arrive in a request body, sharp
 * normalises them, and object-store.ts decides where they land (ADR-0028).
 *
 * This path is for images small enough to pass through a function — category and banner
 * art picked on a desktop. A product's gallery does *not* come through here: a request
 * body through a function is capped at 4.5MB and a phone photograph is routinely larger,
 * so the browser downscales and PUTs straight to the store (bulk-catalog-upload D10).
 * Naming and limits are shared with that path in image-paths.ts.
 */

/**
 * Downscale and re-encode before the bytes reach the store, because what is stored is
 * what is billed on every fetch: a 5MB original and its ~150KB equivalent are
 * indistinguishable in a 105px tile. `animated` keeps a GIF a GIF; `rotate()` applies
 * EXIF orientation before that metadata is dropped, so a phone photo does not arrive
 * sideways.
 */
export async function normalizeImage(
  file: File
): Promise<{ body: Buffer; extension: string; contentType: string; width: number; height: number }> {
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const { data: body, info } = await sharp(input, { animated: true })
      .rotate()
      .resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: Math.round(IMAGE_QUALITY * 100) })
      .toBuffer({ resolveWithObject: true });
    // An animated image reports its stacked height; per-frame height is what a slot wants.
    const height = info.pageHeight ?? info.height;
    return { body, extension: "webp", contentType: "image/webp", width: info.width, height };
  } catch {
    // A declared image type that no decoder accepts is a bad upload, not a server fault.
    throw new DomainError(`Could not read image: ${file.name}`);
  }
}

/** Validates every file first — an upload is all-or-nothing, not a partial batch. */
/** Who an upload belongs to, so its record is born owned (media-library R1). */
export interface UploadOwner {
  orgId: string | null;
  uploaderId: string | null;
}

export async function uploadImages(
  files: File[],
  folder: ImageFolder,
  identifier?: string | null,
  orgCode?: string | null,
  owner?: UploadOwner
): Promise<string[]> {
  if (!files || files.length === 0) {
    throw new DomainError("No files provided");
  }
  for (const file of files) {
    const problem = imageFileProblem(file);
    if (problem) throw new DomainError(problem);
  }

  const urls: string[] = [];
  for (const file of files) {
    const { body, extension, contentType, width, height } = await normalizeImage(file);
    const path = buildImagePath(
      folder,
      normalizedName(file.name, extension),
      identifier,
      orgCode
    );
    urls.push(await putObject(path, body, contentType));
    if (owner) {
      await mediaAssetService.recordServerUpload({
        ...owner,
        pathname: path,
        contentType,
        bytes: body.byteLength,
        width,
        height,
        contentHash: sha256Hex(body),
      });
    }
  }
  return urls;
}
