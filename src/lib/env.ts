/**
 * What the app checks when it starts, from `src/instrumentation.ts`.
 *
 * Two different strengths, on purpose (rate-limiting D2, decisions Q11): `APP_ENV` and the
 * limiter's configuration are refused, because a deployed environment without them would
 * run unlimited; the list below is reported, because it has not been checked against every
 * Vercel environment and refusing on it could take a deploy down for an unrelated reason.
 */
import { appEnv } from "@server/shared/app-env";
import { assertRateLimitConfig } from "@/lib/rate-limit/config";

const requiredEnvVars = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  // Object storage (ADR-0028). Replaced BLOB_READ_WRITE_TOKEN, which nothing reads any
  // more — the Blob store, its package and its migration script are all gone.
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  // Read by next.config.ts at build time for `remotePatterns` as well as at runtime; a
  // wrong value 404s every image at the optimizer with nothing in the logs.
  "R2_PUBLIC_BASE_URL",
] as const;

export function missingEnvVars(env: Record<string, string | undefined> = process.env): string[] {
  return requiredEnvVars.filter((key) => !env[key]);
}

/** Reports what is missing; never throws (Q11). */
export function validateEnv(env: Record<string, string | undefined> = process.env): void {
  const missing = missingEnvVars(env);
  if (missing.length > 0) {
    console.warn(`[env] Missing environment variables: ${missing.join(", ")}`);
  }
}

/** Throws when this environment must not serve requests (spec R2). */
export function checkBootEnvironment(env: Record<string, string | undefined> = process.env): void {
  assertRateLimitConfig(appEnv(), env);
  validateEnv(env);
}
