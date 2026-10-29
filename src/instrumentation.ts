/**
 * Runs once before a server instance takes requests. A deployed environment that cannot
 * enforce rate limits is refused here as well as at build (rate-limiting D2).
 */
import { PHASE_PRODUCTION_BUILD } from "next/constants";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // The build has its own check in next.config.ts, which leaves a build with no declared
  // APP_ENV (CI's) alone; this one is for a server about to serve.
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
  const { checkBootEnvironment } = await import("./lib/env");
  checkBootEnvironment();
}
