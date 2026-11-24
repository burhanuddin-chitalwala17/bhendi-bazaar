import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, needsReencryption } from "@server/shared/crypto";
import { orgDataKeyRepository, type WrappedKey } from "./org-data-key.repository";

/**
 * Chat text sealed under its shop's own data key (ADR-0079; social-selling A-D12). The additional
 * data binds a ciphertext to its shop, table and row, so one pasted elsewhere does not open.
 * Opening is the caller's privilege to check: only a shop's member route, its own automations, or a
 * support grant may call `open` (A-D12); `sealed-columns.test.ts` arrives with the first sealed column.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** `s1.<key version>.<iv>.<tag>.<body>`, base64url, so it never collides with `encryptSecret`'s hex. */
const SEALED = /^s1\.(\d+)\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]*)$/;

/** Where a sealed value lives: what it is bound to. */
export interface SealPlace {
  orgId: string;
  table: string;
  rowId: string;
}

const CACHE_LIMIT = 1_000;
const CACHE_MS = 10 * 60 * 1000;
/** Unwrapped keys by `orgId:version`, newest last; never logged, never returned. */
const cache = new Map<string, { key: Buffer; until: number }>();

function remember(id: string, key: Buffer): Buffer {
  cache.delete(id);
  cache.set(id, { key, until: Date.now() + CACHE_MS });
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return key;
}

function recall(id: string): Buffer | null {
  const hit = cache.get(id);
  if (!hit) return null;
  if (hit.until < Date.now()) {
    cache.delete(id);
    return null;
  }
  return remember(id, hit.key);
}

const unwrap = (wrapped: WrappedKey) => remember(`${wrapped.orgId}:${wrapped.version}`, Buffer.from(decryptSecret(wrapped.wrappedKey), "base64"));

async function currentKey(orgId: string): Promise<{ version: number; key: Buffer }> {
  const stored = (await orgDataKeyRepository.current(orgId)) ?? (await orgDataKeyRepository.createFirst(orgId, encryptSecret(randomBytes(32).toString("base64"))));
  return { version: stored.version, key: recall(`${orgId}:${stored.version}`) ?? unwrap(stored) };
}

async function keyAt(orgId: string, version: number): Promise<Buffer> {
  const cached = recall(`${orgId}:${version}`);
  if (cached) return cached;
  const stored = await orgDataKeyRepository.byVersion(orgId, version);
  if (!stored) throw new SealError("no key");
  return unwrap(stored);
}

/** Each part length-prefixed, so no choice of table and row can spell another place's bytes. */
const aad = (place: SealPlace) => Buffer.from([place.orgId, place.table, place.rowId].map((part) => `${part.length}:${part}`).join(""), "utf8");

/** Never carries the text, the key or the place: only that it did not open. */
export class SealError extends Error {
  constructor(reason: string) {
    super(`A sealed value could not be opened (${reason})`);
    this.name = "SealError";
  }
}

export const seal = {
  async seal(place: SealPlace, text: string): Promise<string> {
    const { version, key } = await currentKey(place.orgId);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(aad(place));
    const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    return `s1.${version}.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
  },

  async open(place: SealPlace, sealed: string): Promise<string> {
    const parts = SEALED.exec(sealed);
    if (!parts) throw new SealError("not sealed");
    const [, version, iv, tag, body] = parts;
    const n = Number(version);
    if (!Number.isSafeInteger(n) || n < 1 || n > 2_147_483_647) throw new SealError("not sealed");
    const key = await keyAt(place.orgId, n);
    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"), { authTagLength: TAG_BYTES });
      decipher.setAAD(aad(place));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
    } catch {
      throw new SealError("does not open here");
    }
  },

  /**
   * Re-wraps every data key still under an older ring version (ADR-0079 decision 4), in batches;
   * no sealed row changes. One key that will not open is counted and skipped, never stops the rest.
   */
  async rewrapStale(batch = 500): Promise<{ rewrapped: number; failed: number }> {
    let rewrapped = 0;
    let failed = 0;
    let after: { orgId: string; version: number } | null = null;
    for (;;) {
      const page = await orgDataKeyRepository.page(after, batch);
      if (page.length === 0) return { rewrapped, failed };
      for (const key of page) {
        try {
          if (!needsReencryption(key.wrappedKey)) continue;
          if (await orgDataKeyRepository.rewrap(key, encryptSecret(decryptSecret(key.wrappedKey)))) rewrapped += 1;
        } catch {
          failed += 1;
          console.error(JSON.stringify({ scope: "seal.rewrap", orgId: key.orgId, version: key.version, error: "unopenable" }));
        }
      }
      after = page[page.length - 1];
    }
  },
};

/** Test seam: forget every unwrapped key. */
export function forgetUnwrappedKeys(): void {
  cache.clear();
}
