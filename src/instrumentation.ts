// Next's startup hook: runs once per server instance, before the first request.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { missingEnv } = await import("@/lib/env");
  const missing = missingEnv();
  if (missing.length > 0) {
    // An error, not a warning: it is what the log drain and error tracking alert on (B7).
    console.error(`[startup] Missing required environment variables: ${missing.join(", ")}`);
  }
}
