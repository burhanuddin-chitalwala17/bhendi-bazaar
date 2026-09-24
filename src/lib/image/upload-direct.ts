import { readApiError } from "@/lib/api-error";

/**
 * Upload one file from the browser straight to the object store.
 *
 * Two steps: ask our own route for permission, then PUT to the URL it signs. The bytes
 * never pass through a function — which is the point, since a request body through one
 * is capped at 4.5MB and a photograph is often larger (bulk-catalog-upload D10).
 *
 * Replaces `@vercel/blob/client`'s `upload()` (ADR-0028). Our route still decides the
 * path, the type and the size; the first two are now signed into the URL rather than
 * carried by a bearer token, and the third is checked but cannot be signed.
 */
export async function uploadDirect(
  pathname: string,
  file: File,
  tokenEndpoint: string
): Promise<string> {
  const permission = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pathname, contentType: file.type, size: file.size }),
  });
  if (!permission.ok) throw await readApiError(permission);
  const { uploadUrl, publicUrl } = (await permission.json()) as {
    uploadUrl: string;
    publicUrl: string;
  };

  // Content-Type must match what was signed, or the signature does not verify. Size is
  // not signed (ADR-0028) — it cannot be — so the route's check on the declared size is
  // what bounds it, and that holds only because the uploader is authenticated.
  let written: Response;
  try {
    written = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
  } catch (cause) {
    // A rejected `fetch` here is never "the server said no" — the request did not
    // complete. In practice that is CORS on the bucket, an extension blocking the
    // request, or the connection dropping mid-file. Saying which it *cannot* be is
    // what stops the next hour going into the signature, which was never involved.
    throw new Error(
      `Could not reach the image store to upload ${pathname}. The request never ` +
        `completed, so this is the network or the bucket's CORS rules rather than ` +
        `the upload permission. (${cause instanceof Error ? cause.message : String(cause)})`,
      { cause },
    );
  }

  if (!written.ok) {
    // The store answers XML with a real error code (SignatureDoesNotMatch,
    // AccessDenied, EntityTooLarge). Dropping it left a bare status number to guess from.
    const detail = await written.text().catch(() => "");
    const code = detail.match(/<Code>([^<]+)<\/Code>/)?.[1];
    throw new Error(
      `Upload failed for ${pathname} (${written.status}${code ? ` ${code}` : ""})`,
    );
  }
  return publicUrl;
}
