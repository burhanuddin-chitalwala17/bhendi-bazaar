// Next's startup hook: runs once per server instance, before the first request.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { missingEnv } = await import("@/lib/env");
  const missing = missingEnv();
  if (missing.length > 0) {
    // Logged here with the names; /api/health?deep=1 answers 503 "config incomplete" for the monitor.
    console.error(`[startup] Missing required environment variables: ${missing.join(", ")}`);
  }
}
