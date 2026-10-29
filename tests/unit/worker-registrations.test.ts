/**
 * The worker loads every job module at boot, and a registration that throws (a schedule under the
 * floor, one schedule too many) kills every job type, not just its own. Each service test calls its
 * service directly, so only loading the modules the way the worker does can catch it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const modules = [...readFileSync(join(ROOT, "worker/main.ts"), "utf8").matchAll(/^import "(@server\/[^"]+)";$/gm)].map((m) => m[1]);

describe("the worker's job modules", () => {
  it("names the modules it loads", () => {
    expect(modules.length).toBeGreaterThanOrEqual(6);
  });

  it("all register together without throwing", async () => {
    const { registeredJobTypes } = await import("@server/shared/jobs/jobs.registry");
    const { registeredSchedules } = await import("@server/shared/jobs/jobs.schedule");
    for (const module of modules) await import(module);
    expect(registeredJobTypes()).toContain("channels.check-orders");
    expect(registeredSchedules().length).toBeGreaterThan(0);
  });
});
