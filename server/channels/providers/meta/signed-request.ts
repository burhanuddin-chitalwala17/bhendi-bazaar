import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Meta's signed request (deauthorize and data deletion callbacks): `base64url(signature).base64url(payload)`,
 * HMAC-SHA256 under the app secret, checked in constant time (meta-foundation D6, D7, D12).
 */

/** Meta sends ids as strings; a number past 2^53 would already have lost digits, so none is taken. */
const PAYLOAD = z.object({ algorithm: z.string(), user_id: z.string().min(1).max(64), issued_at: z.number().int().positive().optional() }).passthrough();

export interface SignedRequest {
  userId: string;
  /** When Meta signed it, where it says. */
  issuedAt: Date | null;
  /** Which of the secrets it matched: 0 is the current one. */
  secretIndex: number;
}

export function readSignedRequest(raw: string, secrets: readonly string[]): SignedRequest | null {
  const parts = raw.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [signaturePart, payloadPart] = parts;
  const given = Buffer.from(signaturePart, "base64url");
  let payload: z.infer<typeof PAYLOAD>;
  try {
    const parsed = PAYLOAD.safeParse(JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")));
    if (!parsed.success) return null;
    payload = parsed.data;
  } catch {
    return null;
  }
  if (payload.algorithm.toUpperCase() !== "HMAC-SHA256") return null;
  for (const [secretIndex, secret] of secrets.entries()) {
    const expected = createHmac("sha256", secret).update(payloadPart).digest();
    if (expected.length === given.length && timingSafeEqual(expected, given)) return { userId: payload.user_id, issuedAt: payload.issued_at ? new Date(payload.issued_at * 1000) : null, secretIndex };
  }
  return null;
}
