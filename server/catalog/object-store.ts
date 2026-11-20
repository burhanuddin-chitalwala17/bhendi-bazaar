/**
 * The object store behind every image the shop serves — Cloudflare R2, spoken to over
 * the S3 API.
 *
 * One seam, so that "where images live" is a single module rather than a decision
 * spread across two upload routes, two bulk wizards and a profile handler. That spread
 * is what made the move off Vercel Blob a ten-file change ([ADR-0028]).
 *
 * Reads never come through here. A stored object is public and is fetched straight from
 * `R2_PUBLIC_BASE_URL` by the browser, at the width the image loader picked, which is the whole reason
 * R2 has no egress meter to exhaust.
 */

import { AwsClient } from "aws4fetch";
import { DomainError } from "@server/shared/domain-error";
import { OUTBOUND_TIMEOUT_MS, transferTimeoutFor } from "@server/shared/deadline";
import { IMAGE_QUALITY } from "@server/catalog/media";
import { DELIVERY_WIDTHS, hasWidthCopies, widthPathFor } from "@server/catalog/image-widths";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * Where the browser fetches an object from: the bucket's custom domain in a deployed
 * environment, its `r2.dev` URL while developing. Never derived from the S3 endpoint —
 * that one carries credentials' worth of meaning and is not public.
 */
export function publicBaseUrl(): string {
  return required("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
}

export function publicUrlFor(pathname: string): string {
  // Each segment is encoded, not the whole path: a `/` is structure, a space is not.
  const encoded = pathname.split("/").map(encodeURIComponent).join("/");
  return `${publicBaseUrl()}/${encoded}`;
}

/**
 * Whether this URL is an object we stored.
 *
 * The bulk schemas use it to refuse a URL that did not come from their own upload step —
 * without it, a crafted payload could point a product at any image on the internet. It
 * checked for a Vercel Blob hostname until ADR-0028; a host-specific literal in a
 * validator is how a storage migration silently starts rejecting its own uploads.
 */
export function isOwnObjectUrl(url: string): boolean {
  return pathnameFor(url) !== null;
}

/** The pathname inside the bucket for one of our public URLs, or null if it is not ours. */
export function pathnameFor(url: string): string | null {
  const base = `${publicBaseUrl()}/`;
  if (!url.startsWith(base)) return null;
  return decodeURIComponent(url.slice(base.length));
}

let cached: { client: AwsClient; endpoint: string } | null = null;

function client(): { client: AwsClient; endpoint: string } {
  if (cached) return cached;
  cached = {
    client: new AwsClient({
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      service: "s3",
      // R2 ignores the region but the signature does not: it must be `auto`.
      region: "auto",
    }),
    endpoint: `${required("R2_ENDPOINT").replace(/\/+$/, "")}/${required("R2_BUCKET")}`,
  };
  return cached;
}

function objectUrl(pathname: string): string {
  const encoded = pathname.split("/").map(encodeURIComponent).join("/");
  return `${client().endpoint}/${encoded}`;
}

/**
 * Store bytes and return the public URL they are now reachable at. A photograph gets its width
 * copies in the same call, so no caller can store one the image loader cannot serve (ADR-0075).
 */
export async function putObject(
  pathname: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await putBytes(pathname, body, contentType);
  if (contentType.startsWith("image/") && hasWidthCopies(pathname)) {
    await writeWidthCopies(pathname, body);
  }
  return publicUrlFor(pathname);
}

/** The copies at every DELIVERY_WIDTH. Never enlarged: a narrow original's copies are its own size. */
async function writeWidthCopies(pathname: string, original: Buffer): Promise<void> {
  // Loaded here rather than at the top: sharp is a native binary, and the route handlers that only
  // presign or delete should not pay for it.
  const { default: sharp } = await import("sharp");
  await Promise.all(
    DELIVERY_WIDTHS.map(async (width) => {
      const copy = await sharp(original, { animated: true })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: Math.round(IMAGE_QUALITY * 100) })
        .toBuffer();
      await putBytes(widthPathFor(pathname, width), copy, "image/webp");
    }),
  );
}

/**
 * Make sure a stored photograph has its width copies, writing them from the original when any is
 * missing. For bytes that reached the store without passing through `putObject` — a browser's
 * presigned PUT — and for the backfill. Returns whether anything was written.
 */
export async function ensureWidthCopies(pathname: string): Promise<boolean> {
  if (!hasWidthCopies(pathname)) return false;
  const present = await Promise.all(DELIVERY_WIDTHS.map((width) => headObject(widthPathFor(pathname, width))));
  if (present.every(Boolean)) return false;
  await writeWidthCopies(pathname, await getObject(pathname));
  return true;
}

async function putBytes(pathname: string, body: Buffer, contentType: string): Promise<void> {
  const response = await client().client.fetch(objectUrl(pathname), {
    method: "PUT",
    signal: AbortSignal.timeout(transferTimeoutFor(body.byteLength)),
    body: new Uint8Array(body),
    headers: {
      "content-type": contentType,
      // Stated explicitly because R2 rejects a PUT without it (411 MissingContentLength)
      // and Next's instrumented fetch does not derive it from the body the way plain
      // undici does — the same call succeeds in a bare Node script and fails in the dev
      // server. Set from the buffer, so it cannot disagree with what is sent.
      "content-length": String(body.byteLength),
      // Objects are immutable — every pathname carries a timestamp or a random suffix —
      // so they can be cached for a year without an invalidation story.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
  if (!response.ok) {
    throw new Error(`Object store rejected ${pathname}: ${response.status} ${await response.text()}`);
  }
}

/** What the store holds at a pathname, or null when nothing does. Used to confirm an upload. */
export async function headObject(
  pathname: string
): Promise<{ contentLength: number; contentType: string } | null> {
  const response = await client().client.fetch(objectUrl(pathname), {
    method: "HEAD",
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.quick),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Could not inspect ${pathname}: ${response.status}`);
  }
  return {
    contentLength: Number(response.headers.get("content-length") ?? 0),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

/** The bytes at a pathname — for reading dimensions the browser could not send, never for serving. */
export async function getObject(
  pathname: string,
  { timeoutMs = OUTBOUND_TIMEOUT_MS.transfer }: { timeoutMs?: number } = {}
): Promise<Buffer> {
  const response = await client().client.fetch(objectUrl(pathname), {
    method: "GET",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Could not read ${pathname}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Remove an object, and a photograph's width copies with it. A URL that is not ours is ignored. */
export async function deleteObject(url: string): Promise<void> {
  const pathname = pathnameFor(url);
  if (!pathname) return;
  const copies = hasWidthCopies(pathname) ? DELIVERY_WIDTHS.map((width) => widthPathFor(pathname, width)) : [];
  await Promise.all([pathname, ...copies].map(deletePath));
}

async function deletePath(pathname: string): Promise<void> {
  const response = await client().client.fetch(objectUrl(pathname), {
    method: "DELETE",
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.quick),
  });
  // 404 is success for a delete: the intent is that it is gone.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not delete ${pathname}: ${response.status}`);
  }
}

/** One page of the bucket's keys, for the width-copy backfill. `next` is null on the last page. */
export async function listObjectKeys(continuation?: string): Promise<{ keys: string[]; next: string | null }> {
  const query = new URLSearchParams({ "list-type": "2", ...(continuation ? { "continuation-token": continuation } : {}) });
  const response = await client().client.fetch(`${client().endpoint}?${query}`, {
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.quick),
  });
  if (!response.ok) throw new Error(`Could not list the bucket: ${response.status}`);
  const xml = await response.text();
  const unescape = (value: string) =>
    value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const keys = [...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((match) => unescape(match[1]));
  const next = /<IsTruncated>true<\/IsTruncated>/.test(xml)
    ? unescape(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1] ?? "") || null
    : null;
  return { keys, next };
}

/** How long a browser has to start an upload it asked permission for. */
const PRESIGN_TTL_SECONDS = 600;

export interface PresignedUpload {
  /** PUT the bytes here, with exactly the content-type and length that were signed. */
  uploadUrl: string;
  /** Where the object will be readable once the PUT succeeds. */
  publicUrl: string;
}

/**
 * Permission for one browser to write one object, of one type, at one path.
 *
 * The path and `content-type` are *signed*, not merely checked, because a presigned URL
 * is the request: anything left unsigned is something the browser may change after we
 * approved it.
 *
 * Size is the exception, and deliberately so. `Content-Length` is a forbidden header —
 * the Fetch `Request` constructor strips it — so it cannot be signed from here, and S3
 * PUT has no equivalent of a POST policy's `content-length-range`. `contentLength` is
 * therefore validated (by the caller's schema, against MAX_IMAGE_BYTES) but not bound:
 * an authenticated uploader who ignores our client could write a larger object. Bounded
 * by authentication rather than by cryptography, and recorded as such in ADR-0028.
 */
export async function presignUpload(
  pathname: string,
  contentType: string,
  contentLength: number
): Promise<PresignedUpload> {
  if (!Number.isInteger(contentLength) || contentLength <= 0) {
    throw new DomainError("Upload size must be a positive whole number of bytes");
  }
  const signed = await client().client.sign(
    new Request(`${objectUrl(pathname)}?X-Amz-Expires=${PRESIGN_TTL_SECONDS}`, {
      method: "PUT",
      headers: { "content-type": contentType },
    }),
    { aws: { signQuery: true, allHeaders: true } }
  );
  return { uploadUrl: signed.url, publicUrl: publicUrlFor(pathname) };
}
