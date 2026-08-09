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

/** Validates every file first — an upload is all-or-nothing, not a partial batch. */
export async function uploadImages(
  files: File[],
  folder: ImageFolder,
  identifier?: string | null
): Promise<string[]> {
  if (!files || files.length === 0) {
    throw new DomainError("No files provided");
  }
  for (const file of files) {
    const problem = imageFileProblem(file);
    if (problem) throw new DomainError(problem);
  }

  const name = sanitizeIdentifier(identifier);
  const urls: string[] = [];
  for (const file of files) {
    const extension = file.name.split(".").pop();
    const filename = `${folder}/${name}-${Date.now()}.${extension}`;
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    });
    urls.push(blob.url);
  }
  return urls;
}
