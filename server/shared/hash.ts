import { createHash } from "node:crypto";

/** SHA-256 as lowercase hex — the one spelling of a content hash on the server. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export const SHA256_HEX = /^[a-f0-9]{64}$/;

/** JSON with keys sorted at every depth, so the same value always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
