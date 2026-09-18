import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import { IMAGE_QUALITY, MAX_IMAGE_EDGE } from "@server/catalog/media";
import { putObject } from "@server/catalog/object-store";

/**
 * Catalog image uploads — one implementation behind two routes (platform admin, org
 * member), so the guard is the only thing that differs. Where the bytes land is
 * server/catalog/object-store.ts (ADR-0028).
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Downscale and re-encode before the bytes reach Blob, because what is stored is what is
 * billed on every fetch: a 5MB original and its ~150KB equivalent are indistinguishable
 * in a 105px tile. `animated` keeps a GIF a GIF; `rotate()` applies EXIF orientation
 * before that metadata is dropped, so a phone photo does not arrive sideways.
 */
export async function normalizeImage(
  file: File
): Promise<{ body: Buffer; extension: string; contentType: string }> {
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const body = await sharp(input, { animated: true })
      .rotate()
      .resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: Math.round(IMAGE_QUALITY * 100) })
      .toBuffer();
    return { body, extension: "webp", contentType: "image/webp" };
  } catch {
    // A declared image type that no decoder accepts is a bad upload, not a server fault.
    throw new DomainError(`Could not read image: ${file.name}`);
  }
}

/** The stored name for a normalized file — same base, WebP extension. */
export function normalizedName(originalName: string, extension: string): string {
  return `${originalName.replace(/\.[^.]*$/, "")}.${extension}`;
}

export type ImageFolder = "products" | "categories" | "banners";

/** A user-attributable reason this file cannot be accepted, or null if it can. */
export function imageFileProblem(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `Invalid file type: ${file.name}. Allowed: JPEG, PNG, WebP, GIF`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `File too large: ${file.name} (max 5MB)`;
  }
  return null;
}

export function sanitizeIdentifier(name: string | null | undefined): string {
  const cleaned = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
  return cleaned || "unnamed";
}

/**
 * Where a catalog image lives in Blob (bulk-catalog-upload D4):
 * `products/<org-code>/<identifier>/<original-name>-<ts>.<ext>`, categories
 * without the org segment. Structured paths make the store browsable per org and
 * product, and keep the original filename — which is what makes a bulk upload's
 * matching debuggable. The timestamp prevents same-name overwrites. Pure and
 * exported so tests pin the shape.
 */
export function buildImagePath(
  folder: ImageFolder,
  originalName: string,
  identifier?: string | null,
  orgCode?: string | null,
  now: number = Date.now()
): string {
  const id = sanitizeIdentifier(identifier);
  const dot = originalName.lastIndexOf(".");
  const base = sanitizeIdentifier(dot > 0 ? originalName.slice(0, dot) : originalName);
  const extension = dot > 0 ? originalName.slice(dot + 1).toLowerCase() : "bin";
  const orgSegment = folder === "products" ? `${sanitizeIdentifier(orgCode)}/` : "";
  return `${folder}/${orgSegment}${id}/${base}-${now}.${extension}`;
}

/** Validates every file first — an upload is all-or-nothing, not a partial batch. */
export async function uploadImages(
  files: File[],
  folder: ImageFolder,
  identifier?: string | null,
  orgCode?: string | null
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
    const { body, extension, contentType } = await normalizeImage(file);
    const path = buildImagePath(
      folder,
      normalizedName(file.name, extension),
      identifier,
      orgCode
    );
    urls.push(await putObject(path, body, contentType));
  }
  return urls;
}
