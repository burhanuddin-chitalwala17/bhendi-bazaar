/**
 * The seam for display reads that may be served from a cache shared across requests (ADR-0065).
 *
 * A read names every table it reads; a write to any of them clears it (`table-writes.ts`), and
 * `tests/integration/read-cache-tables.test.ts` fails if a read touches a table it did not name.
 * `seconds` bounds what nothing clears: a write made outside the web server, by the worker.
 *
 * By default a read goes straight to the database — the worker, scripts and tests. The web
 * server installs Next's data cache at startup (`src/lib/storefront-cache.ts`). Never for money:
 * checkout, cart and payment read live (Invariants 1 and 2).
 */

export interface CachedReadOptions {
  /** Every table the read touches. A tag is cleared per table, so a missing one means stale data. */
  tables: readonly string[];
  /** The longest a result may be served without a write clearing it. */
  seconds: number;
}

export type ReadCache = <T>(key: string, args: readonly unknown[], options: CachedReadOptions, read: () => Promise<T>) => Promise<T>;

const KEY = Symbol.for("bhendi-bazaar.read-cache");
const registry = globalThis as unknown as { [KEY]?: ReadCache };

const direct: ReadCache = (_key, _args, _options, read) => read();

export function installReadCache(cache: ReadCache): void {
  registry[KEY] = cache;
}

/** Test seam: back to reading straight from the database. */
export function resetReadCache(): void {
  delete registry[KEY];
}

/** The tag a write to `table` clears. */
export const tableTag = (table: string): string => `table:${table}`;

/**
 * Serve `read` from the cache when one is installed. `key` names the read and `args` are what
 * varies, so `("product-by-slug", [slug])` is one entry per slug.
 */
export function cachedRead<T>(key: string, args: readonly unknown[], options: CachedReadOptions, read: () => Promise<T>): Promise<T> {
  const unlisted = options.tables.filter((table) => !isCachedTable(table));
  if (unlisted.length > 0) {
    return Promise.reject(new Error(`cachedRead "${key}" declares ${unlisted.join(", ")}, missing from CACHED_TABLES: no write would clear it`));
  }
  return (registry[KEY] ?? direct)(key, args, options, read);
}

/** How long a cached result may be served when no write clears it (a write made by the worker). */
export const CACHED_READ_EXPIRY = {
  /** Offers, categories, org caps, auctions, ratings, reviews, banners: rarely written. */
  slow: 3600,
  /** Product rows carry stock, which a marketplace sale moves from the worker. */
  catalogue: 300,
} as const;

/**
 * Every table some cached read declares. A write clears only these, so a cart, session or job write
 * costs no cache traffic; `tests/integration/read-cache-tables.test.ts` holds each read's tables to it.
 */
export const CACHED_TABLES: ReadonlySet<string> = new Set([
  "Address", "Banner", "BannerAction", "BiddingEvent", "Category", "MediaAsset", "Org", "OrgAddress",
  "Product", "ProductMedia", "ProductStock", "Promotion", "PromotionTarget", "Review", "ReviewMedia",
]);

export const isCachedTable = (table: string): boolean => CACHED_TABLES.has(table);
