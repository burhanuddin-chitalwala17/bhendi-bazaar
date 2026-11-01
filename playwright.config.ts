import { defineConfig, devices } from "@playwright/test";

// Journey smoke tests against a production build (docs/GTM-READINESS.md B8). `.e2e.ts`, not
// `.spec.ts`, so Vitest's default glob never collects them. The port is the build's own origin:
// NEXT_PUBLIC_APP_URL is inlined at build time, and a server on another port would fail the
// same-origin check on the first POST (ADR-0060).
const PORT = Number(new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100").port || 3100);

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // A retry that passes is still reported as flaky, and CI keeps the report either way.
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  // Phone first (ADR-0015), desktop second.
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
