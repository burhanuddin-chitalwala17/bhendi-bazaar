import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";

/**
 * Secrets at rest — marketplace tokens, carrier passwords — as AES-256-GCM under a versioned key
 * (channel-connectors TRD D3). The version travels in the ciphertext, so a key can be replaced
 * and old rows re-encrypted without anyone reconnecting.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 16;
const KEY_HEX = /^[0-9a-f]{64}$/i;
const TAG_BYTES = 16;
const VERSIONED = /^v(\d+):([0-9a-f]{32}):([0-9a-f]{32}):([0-9a-f]*)$/i;

type KeyRing = { current: number; keys: Map<number, Buffer> };

function keyRing(): KeyRing {
  const raw = process.env.CREDENTIAL_KEYS?.trim();
  if (!raw) throw new Error("CREDENTIAL_KEYS is not set; secrets cannot be encrypted or decrypted");
  const keys = new Map<number, Buffer>();
  for (const entry of raw.split(",")) {
    const [version, hex, extra] = entry.trim().split(":");
    const n = Number(version);
    // Never echo the entry: it is key material.
    if (extra !== undefined || !Number.isInteger(n) || n < 1 || !hex || !KEY_HEX.test(hex) || keys.has(n)) {
      throw new Error("CREDENTIAL_KEYS is malformed; expected comma-separated version:64-hex pairs");
    }
    keys.set(n, Buffer.from(hex, "hex"));
  }
  return { current: Math.max(...keys.keys()), keys };
}

/** Shipping's pre-versioned derivation, kept so values it wrote before D3 still decrypt. */
function legacyKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is not set; a legacy secret cannot be decrypted");
  return KEY_HEX.test(key) ? Buffer.from(key, "hex") : pbkdf2Sync(key, "shipping-provider-salt", 100000, 32, "sha256");
}

function open(key: Buffer, ivHex: string, tagHex: string, bodyHex: string): string {
  // Pinned, or Node accepts a truncated tag and the authentication weakens with it.
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"), { authTagLength: TAG_BYTES });
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(bodyHex, "hex", "utf8") + decipher.final("utf8");
}

export function encryptSecret(plaintext: string): string {
  const { current, keys } = keyRing();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keys.get(current)!, iv);
  const body = cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");
  return `v${current}:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${body}`;
}

export function decryptSecret(ciphertext: string): string {
  const versioned = VERSIONED.exec(ciphertext);
  if (versioned) {
    const [, version, iv, tag, body] = versioned;
    const key = keyRing().keys.get(Number(version));
    if (!key) throw new Error(`No key for version ${version} in CREDENTIAL_KEYS`);
    return open(key, iv, tag, body);
  }
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Not an encrypted secret");
  return open(legacyKey(), parts[0], parts[1], parts[2]);
}

/** True when a stored secret is under an older key (or none) and should be re-encrypted. */
export function needsReencryption(ciphertext: string): boolean {
  const versioned = VERSIONED.exec(ciphertext);
  return !versioned || Number(versioned[1]) < keyRing().current;
}
