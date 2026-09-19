/**
 * What an uploaded catalogue image is called, where it lands, and what we accept —
 * the parts of an upload that both sides of the wire must agree on.
 *
 * Split out of image-upload.ts because that module imports sharp, and these are now
 * needed in the browser: a product's gallery uploads browser-to-R2 (ADR-0028), so the
 * path is built client-side and must be the same path the server route would have
 * built, or the presign route's prefix check refuses it. Same reasoning as media.ts.
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/**
 * The ceiling on what is *stored*, checked after the browser has downscaled. Not a
 * limit on what a person may pick: a phone photograph is routinely several times this
 * and becomes a few hundred KB once re-encoded (ADR-0026).
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

/** The stored name for a normalized file — same base, new extension. */
export function normalizedName(originalName: string, extension: string): string {
  return `${originalName.replace(/\.[^.]*$/, "")}.${extension}`;
}

/**
 * Where a catalog image lives in the object store (bulk-catalog-upload D4):
 * `products/<org-code>/<identifier>/<original-name>-<ts>.<ext>`, categories
 * without the org segment. Structured paths make the store browsable per org and
 * product, and keep the original filename — which is what makes a bulk upload's
 * matching debuggable. The timestamp prevents same-name overwrites.
 *
 * The org segment is `sanitizeIdentifier(orgCode)`, which must stay equal to
 * `orgCode.toLowerCase()` — that is the prefix the presign routes check against.
 * tests/unit/image-upload.test.ts pins the agreement for the generated code shape.
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
