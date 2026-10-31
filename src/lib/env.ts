/**
 * The environment variables the app cannot start without.
 *
 * Checked once at server start by `src/instrumentation.ts`, which logs what is missing as an
 * error. It logs rather than throws for now: a deployment missing one would otherwise stop
 * serving entirely, and whether every name below is set in production has not been confirmed
 * (docs/GTM-READINESS.md B7). Once it has, `register()` should throw instead.
 */

const requiredEnvVars = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "APP_ENV",
  "NEXT_PUBLIC_APP_URL",
  "CREDENTIAL_KEYS",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  // Object storage (ADR-0028). Replaced BLOB_READ_WRITE_TOKEN, which nothing reads any
  // more — the Blob store, its package and its migration script are all gone.
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  // Read by next.config.ts at build time for `remotePatterns` as well as at runtime; a
  // wrong value 404s every image at the optimizer with nothing in the logs.
  "R2_PUBLIC_BASE_URL",
  // KV_REST_API_URL / KV_REST_API_TOKEN return here when the rate limiter reads them (B6).
] as const;

export function missingEnv(env: Record<string, string | undefined> = process.env): string[] {
  return requiredEnvVars.filter((key) => !env[key]);
}

export function validateEnv() {
  const missing = missingEnv();

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
