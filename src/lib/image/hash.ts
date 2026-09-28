/**
 * SHA-256 of a file in the browser, as lowercase hex — the same spelling the server records, so a
 * repeat upload is recognised before any bytes move (media-library D11). Returns null where the
 * platform's crypto is missing, and the upload then simply proceeds without deduplication.
 */
export async function sha256HexOf(file: Blob): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
