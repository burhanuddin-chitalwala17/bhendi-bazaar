import { revalidateTag, unstable_cache } from "next/cache";
import { installReadCache, tableTag, type ReadCache } from "@server/shared/read-cache";
import { onTableWrites } from "@server/shared/table-writes";

/**
 * The web server's half of the read cache (ADR-0065): display reads are kept in Next's data
 * cache, shared by every instance, and a write clears every entry that read the table it wrote.
 * Installed once per server instance from `src/instrumentation.ts`.
 *
 * `unstable_cache` and not `"use cache"`: the latter keeps entries in each serverless instance's
 * memory unless Cache Components and a paid remote handler are turned on, so a second visitor
 * would rarely find one (node_modules/next/dist/docs, use-cache "Runtime caching").
 */

// The data cache stores JSON, which turns a Date into a string and a Map into `{}`.
const DATE = "\u0000d";
const MAP = "\u0000m";

export function encode(value: unknown): string {
  return JSON.stringify(value, function (key, v) {
    const raw = (this as Record<string, unknown>)[key];
    if (raw instanceof Date) return { [DATE]: raw.toISOString() };
    if (v instanceof Map) return { [MAP]: [...v.entries()] };
    return v;
  });
}

export function decode<T>(text: string): T {
  return JSON.parse(text, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (DATE in v) return new Date(v[DATE] as string);
      if (MAP in v) return new Map(v[MAP] as [unknown, unknown][]);
    }
    return v;
  }) as T;
}

/** Outside a Next request (a script, the build's own module graph) there is no cache to use. */
const NO_CACHE = "Invariant: incrementalCache missing";

const nextReadCache: ReadCache = async (key, args, { tables, seconds }, read) => {
  // The arguments are unused in the body but are the cache key: Next keys an entry by them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cached = unstable_cache(async (..._args: unknown[]) => encode(await read()), ["read", key], {
    tags: tables.map(tableTag),
    revalidate: seconds,
  });
  try {
    return decode(await cached(...args));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(NO_CACHE)) return read();
    throw error;
  }
};

/**
 * Clear what a write made stale. `expire: 0` so the next visitor waits for fresh data rather than
 * being served the old price. Outside a route handler or action (a page render, a script) Next
 * refuses; the read's own expiry then covers it, as it does for the worker's writes.
 */
function clearTables(tables: ReadonlySet<string>): void {
  for (const table of tables) {
    try {
      revalidateTag(tableTag(table), { expire: 0 });
    } catch {
      // No request to attach the clear to: the expiry stands in.
    }
  }
}

let installed = false;

export function installStorefrontCache(): void {
  if (installed) return;
  installed = true;
  installReadCache(nextReadCache);
  onTableWrites(clearTables);
}
