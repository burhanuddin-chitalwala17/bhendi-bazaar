import { readApiError } from "@/lib/api-error";
import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import { sha256HexOf } from "@/lib/image/hash";

export interface UploadDirectOptions {
  /** Called instead of uploading when the org already holds these bytes; the existing URL is returned. */
  onDuplicate?: (ref: string) => void;
}

/** The browser can usually read a picture's size itself; when it cannot, the server reads the object. */
async function imageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

/**
 * Browser → store, with the record kept true around it (media-library trd D2): ask for
 * permission (which registers the asset), PUT the bytes, then confirm so the record gains its
 * dimensions and becomes usable. A failed confirm is a failed upload — the sweep reclaims it.
 *
 * The bytes are hashed first and the hash travels with the request, so a file the org already
 * holds comes back as that asset's URL and nothing is uploaded twice (media-library D11).
 */
export async function uploadDirect(
  pathname: string,
  file: File,
  endpoints: UploadEndpoints,
  options: UploadDirectOptions = {},
): Promise<string> {
  const contentHash = endpoints.confirm ? await sha256HexOf(file) : null;
  const permission = await fetch(endpoints.token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pathname, contentType: file.type, size: file.size, ...(contentHash ? { contentHash } : {}) }),
  });
  if (!permission.ok) throw await readApiError(permission);
  const granted = (await permission.json()) as
    | { uploadUrl: string; publicUrl: string; assetId?: string; duplicate?: undefined }
    | { duplicate: { ref: string } };
  if (granted.duplicate) {
    options.onDuplicate?.(granted.duplicate.ref);
    return granted.duplicate.ref;
  }
  const { uploadUrl, publicUrl, assetId } = granted;

  let written: Response;
  try {
    written = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type },
      body: file,
    });
  } catch (cause) {
    throw new Error(
      `Could not reach the image store to upload ${pathname}. The request never ` +
        `completed, so this is the network or the bucket's CORS rules rather than ` +
        `the upload permission. (${cause instanceof Error ? cause.message : String(cause)})`,
      { cause },
    );
  }

  if (!written.ok) {
    const detail = await written.text().catch(() => "");
    const code = detail.match(/<Code>([^<]+)<\/Code>/)?.[1];
    throw new Error(
      `Upload failed for ${pathname} (${written.status}${code ? ` ${code}` : ""})`,
    );
  }

  if (assetId && endpoints.confirm) {
    const dims = await imageDimensions(file);
    const confirmed = await fetch(endpoints.confirm, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId, ...(dims ?? {}) }),
    });
    if (!confirmed.ok) throw await readApiError(confirmed);
  }
  return publicUrl;
}
