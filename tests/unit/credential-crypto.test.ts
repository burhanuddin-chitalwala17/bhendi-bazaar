// Secrets at rest under a versioned key (channel-connectors spec R4, TRD D3): a key can be replaced
// without anyone reconnecting, a missing or malformed key fails loudly, and shipping's pre-versioned
// ciphertexts still open.
import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, needsReencryption } from "@server/shared/crypto";

const K1 = "11".repeat(32);
const K2 = "22".repeat(32);
const saved = { keys: process.env.CREDENTIAL_KEYS, legacy: process.env.ENCRYPTION_KEY };

beforeEach(() => {
  process.env.CREDENTIAL_KEYS = `1:${K1}`;
});
const restore = (name: string, value: string | undefined) => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};
afterEach(() => {
  restore("CREDENTIAL_KEYS", saved.keys);
  restore("ENCRYPTION_KEY", saved.legacy);
});

describe("a secret under a versioned key", () => {
  it("round-trips, and the ciphertext names its key version and never the plaintext (spec R4)", () => {
    const sealed = encryptSecret("refresh-token-abc");
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(sealed).not.toContain("refresh-token-abc");
    expect(decryptSecret(sealed)).toBe("refresh-token-abc");
  });

  it("is encrypted fresh each time", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("still opens after a newer key is added, and is then due for re-encryption (spec R4)", () => {
    const old = encryptSecret("token");
    process.env.CREDENTIAL_KEYS = `1:${K1},2:${K2}`;
    expect(decryptSecret(old)).toBe("token");
    expect(needsReencryption(old)).toBe(true);
    const fresh = encryptSecret("token");
    expect(fresh.startsWith("v2:")).toBe(true);
    expect(needsReencryption(fresh)).toBe(false);
  });

  it("refuses to open once its key is removed", () => {
    const old = encryptSecret("token");
    process.env.CREDENTIAL_KEYS = `2:${K2}`;
    expect(() => decryptSecret(old)).toThrow(/No key for version 1/);
  });

  it("refuses a truncated authentication tag", () => {
    const [v, iv, tag, body] = encryptSecret("token").split(":");
    expect(() => decryptSecret([v, iv, tag.slice(0, 8), body].join(":"))).toThrow(/Not an encrypted secret/);
  });

  it("fails if tampered with", () => {
    const sealed = encryptSecret("token");
    const flipped = sealed.slice(0, -1) + (sealed.endsWith("0") ? "1" : "0");
    expect(() => decryptSecret(flipped)).toThrow(/authenticate/);
  });
});

describe("the key ring", () => {
  it("throws when unset, and never falls back silently", () => {
    delete process.env.CREDENTIAL_KEYS;
    expect(() => encryptSecret("x")).toThrow(/CREDENTIAL_KEYS is not set/);
  });

  it.each(["1:short", `0:${K1}`, `1:${K1},1:${K2}`, `one:${K1}`, `1:${K1}:x`])(
    "rejects %s without echoing it",
    (value) => {
      process.env.CREDENTIAL_KEYS = value;
      let message = "";
      try {
        encryptSecret("x");
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/malformed/);
      expect(message).not.toContain(K1);
    },
  );
});

describe("shipping's pre-versioned ciphertext", () => {
  function legacySeal(plaintext: string, key: Buffer): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const body = cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");
    return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${body}`;
  }

  it("opens under a hex ENCRYPTION_KEY and is due for re-encryption", () => {
    process.env.ENCRYPTION_KEY = K2;
    const sealed = legacySeal("carrier-password", Buffer.from(K2, "hex"));
    expect(decryptSecret(sealed)).toBe("carrier-password");
    expect(needsReencryption(sealed)).toBe(true);
  });

  it("opens under a passphrase ENCRYPTION_KEY, derived as before", () => {
    process.env.ENCRYPTION_KEY = "a passphrase";
    const key = pbkdf2Sync("a passphrase", "shipping-provider-salt", 100000, 32, "sha256");
    expect(decryptSecret(legacySeal("pw", key))).toBe("pw");
  });
});
