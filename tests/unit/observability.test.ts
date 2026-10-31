/**
 * Failures reach someone (docs/GTM-READINESS.md B7): the uptime probe, the startup env check, and
 * a deadline on every outbound call in server/.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const queryRaw = vi.fn();
vi.mock("@server/shared/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

const { GET } = await import("@/app/api/health/route");
const { databaseReachable, resetHealthCache } = await import("@server/shared/health");
const { missingEnv } = await import("@/lib/env");
const { withDeadline } = await import("@server/shared/deadline");

beforeEach(() => {
  resetHealthCache();
  queryRaw.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.doUnmock("resend");
});

describe("GET /api/health", () => {
  it("answers a plain ping without touching the database", async () => {
    const response = await GET(new Request("http://x/api/health"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("checks the database on ?deep=1 and answers 503 when it cannot reach it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw.mockRejectedValue(new Error("down"));
    const response = await GET(new Request("http://x/api/health?deep=1"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ database: "unreachable" });
  });

  it("asks the database at most once per window, however often it is pinged", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const t = 1_000_000;
    expect(await databaseReachable(t)).toBe(true);
    expect(await databaseReachable(t + 10_000)).toBe(true);
    expect(await databaseReachable(t + 29_999)).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    await databaseReachable(t + 30_000);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe("startup env check", () => {
  it("names what is missing and nothing that is set", () => {
    const missing = missingEnv({ DATABASE_URL: "x", NEXTAUTH_SECRET: "y" });
    expect(missing).toContain("RAZORPAY_WEBHOOK_SECRET");
    expect(missing).not.toContain("DATABASE_URL");
  });

  it("is wired to the startup hook", () => {
    const hook = readFileSync(resolve(__dirname, "../../src/instrumentation.ts"), "utf8");
    expect(hook).toMatch(/export async function register\(/);
    expect(hook).toMatch(/missingEnv\(\)/);
  });
});

describe("email", () => {
  it("stops waiting when the provider never answers, so the caller hears about it", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.doMock("resend", () => ({
      Resend: class {
        emails = { send: () => new Promise(() => {}) };
      },
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { emailService } = await import("@server/notifications/email.service");

    const sending = emailService
      .sendContactMessage({ subject: "s", message: "m", replyEmail: "a@example.invalid" } as never)
      .catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(15_000);
    const outcome = await sending;
    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toMatch(/took longer than/);

  });
});

describe("withDeadline", () => {
  it("stops waiting for a call that never answers", async () => {
    await expect(withDeadline(new Promise(() => {}), 10, "Sending email")).rejects.toThrow(/Sending email/);
  });
});

/**
 * Every network call in server/ carries a deadline: `signal:` inside the call, or `withDeadline`
 * around it. `widget.fetch` is a dashboard widget's loader, not the network.
 */
describe("outbound calls have a deadline", () => {
  const SERVER = resolve(__dirname, "../../server");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
    });
  const NOT_NETWORK = /\bwidget\.fetch\(/;
  const calls = walk(SERVER).flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return [...text.matchAll(/\bfetch\(/g)]
      .filter((m) => !NOT_NETWORK.test(text.slice(Math.max(0, m.index! - 7), m.index! + 6)))
      .map((m) => ({ file: relative(SERVER, file), at: m.index!, text }));
  });

  it("finds the calls at all", () => {
    expect(calls.length).toBeGreaterThan(8);
  });

  it("each one has a signal or a deadline", () => {
    const bare = calls
      .filter(({ at, text }) => {
        // The call's own argument list, up to its balanced close.
        let depth = 0;
        let end = at + "fetch".length;
        for (; end < text.length; end++) {
          if (text[end] === "(") depth++;
          else if (text[end] === ")" && --depth === 0) break;
        }
        const args = text.slice(at, end);
        const around = text.slice(Math.max(0, at - 300), at);
        return !/\bsignal\b/.test(args) && !/withDeadline\(\s*$/.test(around.trimEnd() + "(") && !/withDeadline\(/.test(around.slice(-80));
      })
      .map(({ file, at, text }) => `${file}:${text.slice(0, at).split("\n").length}`);
    expect(bare, "add `signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.…)`").toEqual([]);
  });
});
