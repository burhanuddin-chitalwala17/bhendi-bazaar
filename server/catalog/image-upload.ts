import { put } from "@vercel/blob";
import { DomainError } from "@server/shared/domain-error";

/**
 * Catalog image uploads to Vercel Blob — one implementation behind two routes
 * (platform admin, org member), so the guard is the only thing that differs.
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageFolder = "products" | "categories";

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
    const blob = await put(buildImagePath(folder, file.name, identifier, orgCode), file, {
      access: "public",
      addRandomSuffix: false,
    });
    urls.push(blob.url);
  }
  return urls;
}
