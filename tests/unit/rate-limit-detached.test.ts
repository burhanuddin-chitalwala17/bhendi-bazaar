/**
 * Rate limiting is detached while the cache is unwired, and that has to stay true by
 * accident-proof means rather than by memory: a limiter that silently allows everything
 * is worse than an absent one, because it gets budgeted for as protection.
 *
 * These tests fail the moment the live path grows a cache dependency again, or the
 * moment `RATE_LIMITING_ENABLED` claims something the exports do not deliver.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  RATE_LIMITING_ENABLED,
  authRateLimit,
  getClientIp,
  withRateLimit,
} from "@/lib/rate-limit";

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** The implementations are kept on purpose; they are simply not wired. */
const PARKED = ["src/lib/rate-limit/upstash.ts", "src/lib/rate-limit/memory.ts"];

describe("the cache is detached from the request path", () => {
  it("no live module imports @upstash", () => {
    const offenders = sourceFiles("src")
      .filter((file) => !PARKED.includes(file))
      .filter((file) => /^\s*import[^;]*@upstash/m.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("nothing imports the parked implementations", () => {
    const offenders = sourceFiles("src").filter((file) =>
      /rate-limit\/(upstash|memory)/.test(readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("keeps both implementations rather than deleting them", () => {
    for (const file of PARKED) {
      expect(readFileSync(file, "utf8")).toContain("PARKED");
    }
  });
});

describe("the seam is honest about doing nothing", () => {
  it("says it is disabled", () => {
    expect(RATE_LIMITING_ENABLED).toBe(false);
  });

  it("allows every request while disabled", async () => {
    expect((await authRateLimit.limit("ip:1.2.3.4")).success).toBe(true);
    expect((await authRateLimit.limit("ip:1.2.3.4")).success).toBe(true);
  });

  it("never returns a 429 response to send", async () => {
    const result = await withRateLimit(
      {} as never,
      { interval: 1000, uniqueTokenPerInterval: 1 },
      () => "ip:1.2.3.4"
    );
    expect(result).toBeNull();
  });
});

// A caller can set `x-forwarded-for`; rotating it defeated every per-IP window.
describe("getClientIp ignores caller-supplied headers", () => {
  const ip = (headers: Record<string, string>) =>
    getClientIp(new Request("https://example.test", { headers }));

  it("refuses x-forwarded-for even when it is the only header", () => {
    expect(ip({ "x-forwarded-for": "9.9.9.9" })).toBe("unknown");
  });

  it("takes the platform's header over the caller's", () => {
    expect(
      ip({ "x-forwarded-for": "9.9.9.9", "x-vercel-forwarded-for": "1.1.1.1" })
    ).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip", () => {
    expect(ip({ "x-real-ip": "2.2.2.2" })).toBe("2.2.2.2");
  });
});
