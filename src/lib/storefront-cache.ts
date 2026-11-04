import { revalidateTag, unstable_cache } from "next/cache";
import { after } from "next/server";
import { installReadCache, isCachedTable, tableTag, type ReadCache } from "@server/shared/read-cache";
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

/**
 * Next serves an entry past its `revalidate` at once and refreshes it behind the response, so on
 * its own `seconds` bounds nothing: the first view after a quiet spell would get data of any age.
 * Each entry carries when it was read, and one older than `seconds` is read live instead.
 */
const nextReadCache: ReadCache = async (key, args, { tables, seconds }, read) => {
  // The arguments are unused in the body but are the cache key: Next keys an entry by them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cached = unstable_cache(async (..._args: unknown[]) => encode({ at: Date.now(), value: await read() }), ["read", key], {
    tags: tables.map(tableTag),
    revalidate: seconds,
  });
  let entry: { at: number; value: Awaited<ReturnType<typeof read>> };
  try {
    entry = decode(await cached(...args));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(NO_CACHE)) return read();
    throw error;
  }
  return Date.now() - entry.at > seconds * 1000 ? read() : entry.value;
};

/** Tables with a clear already waiting for the end of a request, and since when. */
const clearAfterResponse = new Map<string, number>();
/** A waiting clear older than this is assumed lost (its request died) and is scheduled again. */
const AFTER_LOST_MS = 60_000;

/**
 * Clear what a write made stale, twice. Once now, and once after the response, because the write's
 * statement runs before its transaction commits: a page rendered in between would cache the old row
 * with a newer stamp than the first clear. A route handler answers only after awaiting its
 * transaction, so the second clear lands after the commit. `expire: 0`, so the next visitor waits for
 * fresh data rather than being served the old price. Outside a route handler or action (a page
 * render, a script) Next refuses both; the read's own age limit covers it, as for the worker's writes.
 */
function clearTables(tables: ReadonlySet<string>): void {
  for (const table of tables) {
    if (!isCachedTable(table)) continue;
    const tag = tableTag(table);
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      continue; // No request to attach the clear to: the age limit stands in.
    }
    const waiting = clearAfterResponse.get(table);
    if (waiting !== undefined && Date.now() - waiting < AFTER_LOST_MS) continue;
    try {
      clearAfterResponse.set(table, Date.now());
      after(() => {
        clearAfterResponse.delete(table);
        revalidateTag(tag, { expire: 0 });
      });
    } catch {
      clearAfterResponse.delete(table);
    }
  }
}

let installed = false;

export function installStorefrontCache(): void {
  installReadCache(nextReadCache);
  if (installed) return;
  installed = true;
  onTableWrites(clearTables);
}
