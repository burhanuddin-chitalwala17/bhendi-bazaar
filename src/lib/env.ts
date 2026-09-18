/**
 * The environment variables the app cannot start without.
 *
 * ⚠️ **`validateEnv()` is not wired to anything.** Nothing calls it, so this does not
 * currently fail a boot — it is read as documentation, and `docs/OPERATIONS.md` points
 * at it as the canonical list. Kept accurate for that reason, and flagged here so it is
 * not mistaken for an enforced check: a guard that silently does nothing is worse than
 * no guard, because it looks applied.
 *
 * To make it real, call it from `instrumentation.ts` (Next's startup hook).
 */

const requiredEnvVars = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  // Object storage (ADR-0028). Replaced BLOB_READ_WRITE_TOKEN, which the app no longer
  // reads — only the retired scripts/migrate-blob-store.ts does.
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  // Read by next.config.ts at build time for `remotePatterns` as well as at runtime; a
  // wrong value 404s every image at the optimizer with nothing in the logs.
  "R2_PUBLIC_BASE_URL",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

export function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
