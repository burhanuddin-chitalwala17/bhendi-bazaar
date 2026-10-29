/**
 * The rate-limit seam: which backend serves an environment, what a deployed environment must
 * have before it starts, whose address a budget belongs to, and what happens when the store
 * is down (rate-limiting D1–D7). The registry's gate is its own file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redisConstructed = vi.fn();
const upstashLimit = vi.fn();
const ratelimitConfigs: { prefix: string; timeout?: number }[] = [];
vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(config: unknown) {
      redisConstructed(config);
    }
  },
}));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    class {
      constructor(readonly config: { prefix: string; timeout?: number }) {
        ratelimitConfigs.push(config);
      }
      limit(key: string) {
        return upstashLimit(this.config.prefix, key);
      }
    },
    { slidingWindow: (requests: number, window: string) => ({ requests, window }) },
  ),
}));

import { backendFor, failOpen, limiterFor, resetLimiters, LIMITER_BACKEND } from "@/lib/rate-limit/limiter";
import {
  assertRateLimitConfig,
  assertRateLimitConfigAtBuild,
  missingRateLimitConfig,
  RATE_LIMIT_ENV,
} from "@/lib/rate-limit/config";
import { clientAddress, resetClientAddressReport } from "@/lib/rate-limit/client-address";
import { memoryLimiter } from "@/lib/rate-limit/memory";
import { upstashLimiter } from "@/lib/rate-limit/upstash";
import { RATE_LIMIT_POLICY } from "@/lib/rate-limit/policies";
import { RateLimitedError } from "@/lib/rate-limit/refusal";
import { isRefusalMessage } from "@/lib/rate-limit/copy";
import { checkBootEnvironment } from "@/lib/env";
import { toErrorResponse } from "@/lib/api-error-response";

const FULL = {
  [RATE_LIMIT_ENV.STORE_URL]: "https://store.example",
  [RATE_LIMIT_ENV.STORE_TOKEN]: "token",
  [RATE_LIMIT_ENV.CLIENT_IP_HEADER]: "x-vercel-forwarded-for",
};

const headers = (values: Record<string, string>) => new Headers(values);

beforeEach(() => {
  resetLimiters();
  resetClientAddressReport();
  for (const name of Object.values(RATE_LIMIT_ENV)) vi.stubEnv(name, "");
});
afterEach(() => vi.unstubAllEnvs());

describe("backend selection (D1)", () => {
  it("local is the in-process limiter; preview and production share the store", () => {
    expect(backendFor("local")).toBe(LIMITER_BACKEND.MEMORY);
    expect(backendFor("preview")).toBe(LIMITER_BACKEND.SHARED);
    expect(backendFor("production")).toBe(LIMITER_BACKEND.SHARED);
  });

  it("local never constructs a Redis client, even with store keys present (spec R4)", async () => {
    vi.stubEnv("APP_ENV", "local");
    vi.stubEnv("KV_REST_API_URL", "https://store.example");
    vi.stubEnv("KV_REST_API_TOKEN", "token");
    await limiterFor(RATE_LIMIT_POLICY.AUTH).limit("k");
    expect(redisConstructed).not.toHaveBeenCalled();
    expect(upstashLimit).not.toHaveBeenCalled();
  });

  it("preview reaches the shared store under the policy's prefix (spec R3)", async () => {
    vi.stubEnv("APP_ENV", "preview");
    for (const [name, value] of Object.entries(FULL)) vi.stubEnv(name, value);
    upstashLimit.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 1, pending: Promise.resolve() });
    const result = await limiterFor(RATE_LIMIT_POLICY.AUTH).limit("POST /api/auth/signup|ip:1.1.1.1");
    expect(redisConstructed).toHaveBeenCalledWith({ url: "https://store.example", token: "token" });
    expect(upstashLimit).toHaveBeenCalledWith("ratelimit:preview:auth", "POST /api/auth/signup|ip:1.1.1.1");
    expect(result).toEqual({ success: true, limit: 5, remaining: 4, reset: 1 });
  });

  it("keeps preview and production budgets apart in one store (decisions Q19)", async () => {
    for (const [name, value] of Object.entries(FULL)) vi.stubEnv(name, value);
    upstashLimit.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 1 });
    for (const env of ["preview", "production"]) {
      resetLimiters();
      vi.stubEnv("APP_ENV", env);
      await limiterFor(RATE_LIMIT_POLICY.AUTH).limit("k");
    }
    expect(upstashLimit.mock.calls.slice(-2).map(([prefix]) => prefix)).toEqual([
      "ratelimit:preview:auth",
      "ratelimit:production:auth",
    ]);
  });

  it("reads the integration's KV_REST_API_* names as a fallback (D8)", () => {
    expect(
      missingRateLimitConfig({
        KV_REST_API_URL: "u",
        KV_REST_API_TOKEN: "t",
        [RATE_LIMIT_ENV.CLIENT_IP_HEADER]: "x-real-ip",
      }),
    ).toEqual([]);
  });
});

describe("a deployed environment that cannot enforce is refused (spec R2, A3)", () => {
  it("throws for preview and production with any value missing", () => {
    for (const env of ["preview", "production"] as const) {
      expect(() => assertRateLimitConfig(env, {})).toThrow(/RATE_LIMIT_STORE_URL.*RATE_LIMIT_CLIENT_IP_HEADER/);
      expect(() => assertRateLimitConfig(env, { ...FULL, [RATE_LIMIT_ENV.CLIENT_IP_HEADER]: "" })).toThrow(
        /RATE_LIMIT_CLIENT_IP_HEADER/,
      );
      expect(() => assertRateLimitConfig(env, FULL)).not.toThrow();
    }
  });

  it("local needs nothing", () => {
    expect(() => assertRateLimitConfig("local", {})).not.toThrow();
  });

  it("the build refuses a declared deployed environment and leaves an undeclared one to boot", () => {
    expect(() => assertRateLimitConfigAtBuild({ APP_ENV: "production" })).toThrow(/cannot be enforced/);
    expect(() => assertRateLimitConfigAtBuild({ APP_ENV: "preview", ...FULL })).not.toThrow();
    expect(() => assertRateLimitConfigAtBuild({})).not.toThrow();
  });

  it("the boot check refuses a deployed environment and only reports the rest of the list", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("APP_ENV", "production");
    expect(() => checkBootEnvironment({})).toThrow(/Rate limiting cannot be enforced/);
    expect(() => checkBootEnvironment({ ...FULL })).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL"));
    warn.mockRestore();
  });
});

describe("the caller's address (D4, spec R7)", () => {
  beforeEach(() => vi.stubEnv(RATE_LIMIT_ENV.CLIENT_IP_HEADER, "x-vercel-forwarded-for"));

  it("ignores a forged x-forwarded-for (spec A5)", () => {
    const one = clientAddress(headers({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "9.9.9.9" }), true);
    const two = clientAddress(headers({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "8.8.8.8" }), true);
    expect(one).toBe("1.1.1.1");
    expect(two).toBe("1.1.1.1");
    expect(clientAddress(headers({ "x-forwarded-for": "9.9.9.9" }), true)).toBe("unknown");
  });

  it("takes the last entry of a list, the one the edge added", () => {
    expect(clientAddress(headers({ "x-vercel-forwarded-for": "6.6.6.6, 1.1.1.1" }), true)).toBe("1.1.1.1");
  });

  it("reports a deployed request without the configured header, once", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    clientAddress(headers({}), true);
    clientAddress(headers({}), true);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain("x-vercel-forwarded-for");
    error.mockRestore();
  });

  it("locally, with nothing configured, everything is one developer", () => {
    vi.stubEnv(RATE_LIMIT_ENV.CLIENT_IP_HEADER, "");
    expect(clientAddress(headers({ "x-forwarded-for": "9.9.9.9" }), false)).toBe("local");
  });
});

describe("the in-process limiter (D1a, D7)", () => {
  it("refuses past its budget and reopens after its window", async () => {
    let now = 0;
    const limiter = memoryLimiter({ requests: 2, windowSeconds: 60 }, { now: () => now });
    expect((await limiter.limit("a")).success).toBe(true);
    expect((await limiter.limit("a")).success).toBe(true);
    const refused = await limiter.limit("a");
    expect(refused).toMatchObject({ success: false, remaining: 0, reset: 60_000 });
    expect((await limiter.limit("b")).success).toBe(true);
    now = 60_000;
    expect((await limiter.limit("a")).success).toBe(true);
  });

  it("stays bounded however many callers it sees", async () => {
    const limiter = memoryLimiter({ requests: 1, windowSeconds: 60 }, { maxKeys: 100, now: () => 0 });
    for (let i = 0; i < 1000; i++) await limiter.limit(`caller-${i}`);
    expect(limiter.size()).toBeLessThanOrEqual(100);
    // The newest caller is still counted; the oldest made room.
    expect((await limiter.limit("caller-999")).success).toBe(false);
  });
});

describe("an unreachable store fails open, loudly (D3, spec A4)", () => {
  it("allows the request and logs the fault", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const limiter = failOpen(RATE_LIMIT_POLICY.PAYMENT, {
      limit: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect((await limiter.limit("k")).success).toBe(true);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("store unreachable"), expect.any(Error));
    error.mockRestore();
  });

  it("gives up on a slow store after a second, allows, and logs once per window (decisions Q20)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let at = 0;
    const limiter = upstashLimiter(
      RATE_LIMIT_POLICY.PAYMENT,
      { requests: 10, windowSeconds: 60 },
      { url: "https://store.example", token: "token" },
      "production",
      () => at,
    );
    expect(ratelimitConfigs.at(-1)?.timeout).toBe(1000);
    upstashLimit.mockResolvedValue({ success: true, limit: 10, remaining: 10, reset: 0, reason: "timeout" });
    const timedOut = () => error.mock.calls.filter(([message]: unknown[]) => String(message).includes("timed out"));

    expect((await limiter.limit("k")).success).toBe(true);
    at = 59_999;
    expect((await limiter.limit("k")).success).toBe(true);
    expect(timedOut()).toHaveLength(1);
    at = 60_000;
    await limiter.limit("k");
    expect(timedOut()).toHaveLength(2);

    upstashLimit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 });
    at = 200_000;
    await limiter.limit("k");
    expect(timedOut()).toHaveLength(2);
    error.mockRestore();
  });

  it("passes a working limiter's answer through untouched", async () => {
    const answer = { success: false, limit: 5, remaining: 0, reset: 123 };
    const limiter = failOpen(RATE_LIMIT_POLICY.PAYMENT, { limit: async () => answer });
    expect(await limiter.limit("k")).toBe(answer);
  });
});

describe("the refusal travels in the envelope (D6, spec R6)", () => {
  it("is a 429 with a retry time and the rate-limit headers", async () => {
    const response = toErrorResponse(
      new RateLimitedError({ success: false, limit: 5, remaining: 0, reset: 600_000 }, 0),
    );
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toMatch(/^Too many attempts\. Please try again in \d+ minutes?\.$/);
    expect(isRefusalMessage(body.error)).toBe(true);
    expect(response.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
  });
});
