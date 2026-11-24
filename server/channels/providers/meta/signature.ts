import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta's `X-Hub-Signature-256` over the bytes as received, in constant time, under each signing
 * secret (meta-foundation D3, D12). Never over decoded text: a decoder rewrites bytes it cannot read.
 */

const HEADER = /^sha256=([0-9a-f]{64})$/;

export type SignatureCheck = { valid: false } | { valid: true; previousSecret: boolean };

export function verifyMetaSignature(body: Uint8Array, header: string | null, secrets: readonly string[]): SignatureCheck {
  const match = HEADER.exec(header?.trim().toLowerCase() ?? "");
  if (!match) return { valid: false };
  const given = Buffer.from(match[1], "hex");
  for (const [index, secret] of secrets.entries()) {
    const expected = createHmac("sha256", secret).update(body).digest();
    if (expected.length === given.length && timingSafeEqual(expected, given)) {
      return { valid: true, previousSecret: index > 0 };
    }
  }
  return { valid: false };
}

/** Meta's verification handshake compares our token in constant time too. */
export function sameToken(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
