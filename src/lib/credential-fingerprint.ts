import { createHmac } from "node:crypto";

/**
 * Which password a session was issued under, without carrying the hash: an HMAC keyed by the auth
 * secret. A changed or cleared password changes it, which ends every older session (GTM B5).
 */
export function credentialFingerprint(passwordHash: string | null | undefined): string {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "")
    .update(passwordHash ?? "")
    .digest("base64url")
    .slice(0, 22);
}
