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
const { withDeadline, transferTimeoutFor } = await import("@server/shared/deadline");

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

  it("answers 503 when configuration is incomplete, without naming what is missing", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    const response = await GET(new Request("http://x/api/health?deep=1"));
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({ config: "incomplete", database: "ok" });
    expect(body).not.toMatch(/RAZORPAY|SECRET/);
  });

  it("pings during a slow probe share it rather than each sending another", async () => {
    let finish!: () => void;
    queryRaw.mockReturnValue(new Promise((r) => (finish = () => r([]))));
    const t = 5_000_000;
    const a = databaseReachable(t);
    const b = databaseReachable(t + 1);
    finish();
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(1);
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

describe("transfer deadlines", () => {
  it("grow with size, so a 200 MB video is not held to an image's minute", () => {
    expect(transferTimeoutFor(5 * 1024 * 1024)).toBe(60_000);
    expect(transferTimeoutFor(200 * 1024 * 1024)).toBeGreaterThanOrEqual(10 * 60_000);
  });

  it("the video job reads its source with the bulk deadline", () => {
    const job = readFileSync(resolve(__dirname, "../../server/catalog/video.jobs.ts"), "utf8");
    expect(job).toMatch(/getObject\(objectKey, \{ timeoutMs: OUTBOUND_TIMEOUT_MS\.bulk \}\)/);
  });
});

describe("withDeadline", () => {
  it("stops waiting for a call that never answers", async () => {
    await expect(withDeadline(new Promise(() => {}), 10, "Sending email")).rejects.toThrow(/Sending email/);
  });
});

/**
 * Every network call in server/ and worker/ carries a deadline: `signal: AbortSignal.timeout(…)` or
 * `AbortSignal.any(…)` inside the call, or `withDeadline(` directly around it. Comments are
 * stripped first, so the word "signal" in one proves nothing. `widget.fetch` is not the network.
 */
describe("outbound calls have a deadline", () => {
  const ROOTS = ["server", "worker"].map((d) => resolve(__dirname, "../..", d));
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
    });
  const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/.*$/gm, (m, p) => p + " ".repeat(m.length - p.length));
  const calls = ROOTS.flatMap(walk).flatMap((file) => {
    const text = stripComments(readFileSync(file, "utf8"));
    return [...text.matchAll(/\bfetch\(/g)]
      .filter((m) => !/widget\.$/.test(text.slice(Math.max(0, m.index! - 7), m.index!)))
      .map((m) => ({ file: relative(resolve(__dirname, "../.."), file), at: m.index!, text }));
  });

  it("finds the calls at all", () => {
    expect(calls.length).toBeGreaterThan(8);
  });

  it("each one has a deadline", () => {
    const bare = calls
      .filter(({ at, text }) => {
        let depth = 0;
        let end = at + "fetch".length;
        for (; end < text.length; end++) {
          if (text[end] === "(") depth++;
          else if (text[end] === ")" && --depth === 0) break;
        }
        const args = text.slice(at, end);
        const wrapped = /withDeadline\(\s*(await\s+)?[\w.()]*$/.test(text.slice(Math.max(0, at - 120), at));
        return !/signal:\s*AbortSignal\.(timeout|any)\(/.test(args) && !wrapped;
      })
      .map(({ file, at, text }) => `${file}:${text.slice(0, at).split("\n").length}`);
    expect(bare, "add `signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS.…)`").toEqual([]);
  });
});
