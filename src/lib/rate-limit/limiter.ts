/**
 * Which limiter serves a policy, chosen by `APP_ENV` and nothing else (rate-limiting D1):
 * local gets the in-process one, preview and production the shared store. A store fault
 * fails open and is logged every time (D3) — the alert arrives with error-tracking (Q14).
 */
import { appEnv, type AppEnv } from "@server/shared/app-env";
import { isDeployed, rateLimitStore } from "./config";
import { memoryLimiter } from "./memory";
import { POLICY_BUDGETS, type RateLimitPolicy } from "./policies";
import type { RateLimiter, RateLimitResult } from "./types";
import { resetTimeoutLog, upstashLimiter } from "./upstash";

export const LIMITER_BACKEND = { MEMORY: "memory", SHARED: "shared" } as const;
export type LimiterBackend = (typeof LIMITER_BACKEND)[keyof typeof LIMITER_BACKEND];

export function backendFor(env: AppEnv): LimiterBackend {
  return isDeployed(env) ? LIMITER_BACKEND.SHARED : LIMITER_BACKEND.MEMORY;
}

const limiters = new Map<RateLimitPolicy, RateLimiter>();
let warnedLocal = false;

function build(policy: RateLimitPolicy, env: AppEnv): RateLimiter {
  const budget = POLICY_BUDGETS[policy];
  if (backendFor(env) === LIMITER_BACKEND.MEMORY) {
    if (!warnedLocal) {
      warnedLocal = true;
      console.warn(
        "[rate-limit] APP_ENV=local: limits are per-process and in memory. " +
          "Preview and production share them through the store."
      );
    }
    return memoryLimiter(budget);
  }
  const store = rateLimitStore();
  // The build and boot checks refuse this state; reaching it means both were bypassed.
  if (!store) throw new Error(`Rate-limit store is not configured in APP_ENV=${env}`);
  return upstashLimiter(policy, budget, store, env);
}

const allowed = (): RateLimitResult => ({ success: true, limit: 0, remaining: 0, reset: Date.now() });

/** Wraps a limiter so a store fault allows the request and says so. */
export function failOpen(policy: RateLimitPolicy, limiter: RateLimiter): RateLimiter {
  return {
    async limit(key) {
      try {
        return await limiter.limit(key);
      } catch (error) {
        console.error(`[rate-limit] ${policy}: store unreachable, request allowed`, error);
        return allowed();
      }
    },
  };
}

export function limiterFor(policy: RateLimitPolicy): RateLimiter {
  const cached = limiters.get(policy);
  if (cached) return cached;
  let real: RateLimiter;
  try {
    real = build(policy, appEnv());
  } catch (error) {
    // A construction fault is a logged allow on every request, never a 500 (D3).
    real = { limit: async () => { throw error; } };
  }
  const limiter = failOpen(policy, real);
  limiters.set(policy, limiter);
  return limiter;
}

/** For tests: forget built limiters and the one-time logs. */
export function resetLimiters() {
  limiters.clear();
  warnedLocal = false;
  resetTimeoutLog();
}
