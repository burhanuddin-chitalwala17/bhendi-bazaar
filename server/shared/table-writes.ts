/**
 * Which tables a SQL statement reads or writes, and who wants to hear about writes. The prisma
 * client reports every statement here; the storefront cache listens and clears what a write
 * made stale (ADR-0065). The registry lives on globalThis because a Next server can load this
 * module more than once (one copy per bundle) and every copy must reach the same listeners.
 */

const WRITE = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:"public"\.)?"(\w+)"/gi;
const READ = /\b(?:FROM|JOIN)\s+(?:"public"\.)?"(\w+)"/gi;

type Listener = (tables: ReadonlySet<string>) => void;
const KEY = Symbol.for("bhendi-bazaar.table-writes");
const registry = globalThis as unknown as { [KEY]?: Listener[] };
const listeners = (): Listener[] => (registry[KEY] ??= []);

const matches = (pattern: RegExp, sql: string): Set<string> =>
  new Set([...sql.matchAll(pattern)].map((m) => m[1]));

/**
 * Database functions that write tables their call does not name (listing-model/dynamic-form Q16): a product's
 * answers are written by these, so a call must clear what reads ProductValue (review B3).
 */
const FUNCTION_WRITES: ReadonlyArray<[RegExp, string]> = [[/\bbb_(?:write_answers|write_inherited|rederive_answers)\s*\(/i, "ProductValue"]];

/** Tables the statement writes. `FOR UPDATE` and `DO UPDATE SET` name no table, so they are not writes here. */
export const tablesWritten = (sql: string): Set<string> => {
  const written = matches(WRITE, sql);
  for (const [call, table] of FUNCTION_WRITES) if (call.test(sql)) written.add(table);
  return written;
};

/** Tables the statement reads, for the test that holds each cached read to the tables it declares. */
export const tablesRead = (sql: string): Set<string> => matches(READ, sql);

export function onTableWrites(listener: Listener): () => void {
  listeners().push(listener);
  return () => {
    const all = listeners();
    const at = all.indexOf(listener);
    if (at >= 0) all.splice(at, 1);
  };
}

/** Called by the prisma client for every statement it runs. */
export function noteStatement(sql: string): void {
  const all = listeners();
  if (all.length === 0) return;
  const written = tablesWritten(sql);
  if (written.size === 0) return;
  for (const listener of all) listener(written);
}
