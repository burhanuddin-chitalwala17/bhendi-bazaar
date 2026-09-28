import { createHash } from "node:crypto";

/** SHA-256 as lowercase hex — the one spelling of a content hash on the server. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export const SHA256_HEX = /^[a-f0-9]{64}$/;
