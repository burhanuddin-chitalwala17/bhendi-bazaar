/**
 * Connections per instance from DATABASE_POOL_MAX (GTM B12). At least 3: a transaction holding one
 * connection can need a second, so 1 or 2 lets two checkouts at once wait out the pool timeout.
 */
export const MIN_POOL = 3;

export function poolMax(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < MIN_POOL) {
    console.error(`[db] DATABASE_POOL_MAX=${JSON.stringify(raw)} is not a whole number of at least ${MIN_POOL}; using ${fallback}.`);
    return fallback;
  }
  return n;
}
