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
export function normalizedName(
  originalName: string,
  extension: string,
): string {
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
  now: number = Date.now(),
): string {
  const id = sanitizeIdentifier(identifier);
  const dot = originalName.lastIndexOf(".");
  const base = sanitizeIdentifier(
    dot > 0 ? originalName.slice(0, dot) : originalName,
  );
  const extension = dot > 0 ? originalName.slice(dot + 1).toLowerCase() : "bin";
  const orgSegment =
    folder === "products" ? `${sanitizeIdentifier(orgCode)}/` : "";
  return `${folder}/${orgSegment}${id}/${base}-${now}.${extension}`;
}

/**
 * The hostname of the retired Vercel Blob store (ADR-0028, OPERATIONS.md "Images left
 * behind on the retired store"). Rows still hold URLs on it; the bytes answer `403`
 * and the host is deliberately absent from `next.config.ts` `remotePatterns`.
 */
const RETIRED_STORE_HOST = ".blob.vercel-storage.com";

/**
 * Whether this stored URL can actually be rendered.
 *
 * `next/image` does not degrade on a host it has no `remotePatterns` entry for — it
 * **throws** `Invalid src prop`, which unmounts the whole page rather than the one
 * picture. That turned a single leftover row into a blank `/admin/banners`, and
 * `/admin/banners` is where the documented remedy — re-upload the image — has to
 * happen. A dead URL must read as "no image", never as a crash.
 *
 * Deliberately a check for the one *retired* host rather than an allowlist of live
 * ones: the live host is `R2_PUBLIC_BASE_URL`, which is server-only configuration, and
 * this has to answer in the browser too.
 */
export function isRenderableImageUrl(
  url: string | null | undefined,
): url is string {
  if (!url) return false;
  if (
    url.startsWith("/") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return true;
  }
  try {
    return !new URL(url).hostname.endsWith(RETIRED_STORE_HOST);
  } catch {
    // Not a URL at all. Whatever it is, next/image will not take it.
    return false;
  }
}

/**
 * A gallery with its dead photographs dropped, so each surface's empty-gallery branch
 * handles them. Only `IMAGE` refs are URLs; a video ref is a provider id, never checked here.
 */
export function renderableMedia<M extends { kind: string; ref: string }>(
  media: M[],
): M[] {
  return media.filter(
    (item) => item.kind !== "IMAGE" || isRenderableImageUrl(item.ref),
  );
}
