/**
 * The limiter's configuration, and the assertion that a deployed environment has it
 * (rate-limiting D2, D8, decisions Q11, Q17). Relative imports only: `next.config.ts`
 * loads this before path aliases exist.
 */
import { APP_ENVS, type AppEnv } from "../../../server/shared/app-env";

export const RATE_LIMIT_ENV = {
  STORE_URL: "RATE_LIMIT_STORE_URL",
  STORE_TOKEN: "RATE_LIMIT_STORE_TOKEN",
  CLIENT_IP_HEADER: "RATE_LIMIT_CLIENT_IP_HEADER",
  // What Vercel's Upstash integration provisions; read for one release (D8).
  LEGACY_STORE_URL: "KV_REST_API_URL",
  LEGACY_STORE_TOKEN: "KV_REST_API_TOKEN",
} as const;

type Env = Record<string, string | undefined>;

export function isDeployed(env: AppEnv): boolean {
  return env !== "local";
}

export function rateLimitStore(env: Env = process.env): { url: string; token: string } | null {
  const url = env[RATE_LIMIT_ENV.STORE_URL] || env[RATE_LIMIT_ENV.LEGACY_STORE_URL];
  const token = env[RATE_LIMIT_ENV.STORE_TOKEN] || env[RATE_LIMIT_ENV.LEGACY_STORE_TOKEN];
  return url && token ? { url, token } : null;
}

export function clientAddressHeader(env: Env = process.env): string | null {
  return env[RATE_LIMIT_ENV.CLIENT_IP_HEADER]?.trim().toLowerCase() || null;
}

/** The variables a deployed environment is missing; empty when it can enforce. */
export function missingRateLimitConfig(env: Env = process.env): string[] {
  const missing: string[] = [];
  if (!(env[RATE_LIMIT_ENV.STORE_URL] || env[RATE_LIMIT_ENV.LEGACY_STORE_URL])) {
    missing.push(RATE_LIMIT_ENV.STORE_URL);
  }
  if (!(env[RATE_LIMIT_ENV.STORE_TOKEN] || env[RATE_LIMIT_ENV.LEGACY_STORE_TOKEN])) {
    missing.push(RATE_LIMIT_ENV.STORE_TOKEN);
  }
  if (!clientAddressHeader(env)) missing.push(RATE_LIMIT_ENV.CLIENT_IP_HEADER);
  return missing;
}

/** Throws in a deployed environment that cannot enforce limits (spec R2, A3). */
export function assertRateLimitConfig(appEnv: AppEnv, env: Env = process.env): void {
  if (!isDeployed(appEnv)) return;
  const missing = missingRateLimitConfig(env);
  if (missing.length > 0) {
    throw new Error(
      `Rate limiting cannot be enforced in APP_ENV=${appEnv}: set ${missing.join(", ")} ` +
        "(docs/OPERATIONS.md, rate limiting). Refusing to start unlimited."
    );
  }
}

/**
 * The build's check. Only an explicitly deployed `APP_ENV` is asserted: a CI or local build
 * declares none, and the boot check (`src/instrumentation.ts`) refuses an unset one at runtime.
 */
export function assertRateLimitConfigAtBuild(env: Env = process.env): void {
  const declared = env.APP_ENV;
  const known = (APP_ENVS as readonly string[]).includes(declared ?? "");
  if (known) assertRateLimitConfig(declared as AppEnv, env);
}
