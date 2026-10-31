/**
 * Whether this deployment can reach its database, asked at most once per window however often a
 * monitor pings (docs/GTM-READINESS.md B7). Every statement is billed on Prisma Postgres, and a
 * health check must not become the load it is meant to notice.
 */
const WINDOW_MS = 30_000;

let last: { at: number; ok: boolean } | null = null;

export async function databaseReachable(now = Date.now()): Promise<boolean> {
  if (last && now - last.at < WINDOW_MS) return last.ok;
  let ok = false;
  try {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.$queryRaw`SELECT 1`;
    ok = true;
  } catch (error) {
    console.error("[health] database unreachable:", error);
  }
  last = { at: now, ok };
  return ok;
}

/** For tests: forget the cached answer. */
export function resetHealthCache() {
  last = null;
}
