// At most one database probe per window per instance, so a monitor never becomes the load (GTM B7).
import { withDeadline } from "@server/shared/deadline";

const WINDOW_MS = 30_000;
const QUERY_DEADLINE_MS = 5_000;

let last: { at: number; ok: Promise<boolean> } | null = null;

export function databaseReachable(now = Date.now()): Promise<boolean> {
  // The pending probe is cached too, so pings during a slow one share it instead of piling on.
  if (last && now - last.at < WINDOW_MS) return last.ok;
  const ok = (async () => {
    try {
      const { prisma } = await import("@server/shared/prisma");
      await withDeadline(prisma.$queryRaw`SELECT 1`, QUERY_DEADLINE_MS, "Health query");
      return true;
    } catch (error) {
      console.error("[health] database unreachable:", error);
      return false;
    }
  })();
  last = { at: now, ok };
  return ok;
}

/** For tests: forget the cached answer. */
export function resetHealthCache() {
  last = null;
}
