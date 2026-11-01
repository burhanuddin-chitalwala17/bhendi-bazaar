/**
 * The object store behind every image the shop serves — Cloudflare R2, spoken to over
 * the S3 API.
 *
 * One seam, so that "where images live" is a single module rather than a decision
 * spread across two upload routes, two bulk wizards and a profile handler. That spread
 * is what made the move off Vercel Blob a ten-file change ([ADR-0028]).
 *
 * Reads never come through here. A stored object is public and is fetched straight from
 * `R2_PUBLIC_BASE_URL` by the browser or the image optimizer, which is the whole reason
 * R2 has no egress meter to exhaust.
 */

import { AwsClient } from "aws4fetch";
import { DomainError } from "@server/shared/domain-error";
import { OUTBOUND_TIMEOUT_MS, transferTimeoutFor } from "@server/shared/deadline";

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

/** Store bytes and return the public URL they are now reachable at. */
export async function putObject(
  pathname: string,
  body: Buffer,
  contentType: string
): Promise<string> {
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
  return publicUrlFor(pathname);
}

/** Remove an object. A URL that is not ours is ignored rather than guessed at. */
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

export async function deleteObject(url: string): Promise<void> {
  const pathname = pathnameFor(url);
  if (!pathname) return;
  const response = await client().client.fetch(objectUrl(pathname), {
    method: "DELETE",
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.quick),
  });
  // 404 is success for a delete: the intent is that it is gone.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not delete ${pathname}: ${response.status}`);
  }
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
