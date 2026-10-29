/**
 * The shared limiter every deployed environment uses (rate-limiting D1): a sliding window in
 * Upstash Redis, so the count holds across instances. One Redis client per store.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { AppEnv } from "@server/shared/app-env";
import type { Budget, RateLimitPolicy } from "./policies";
import type { RateLimiter } from "./types";

/** A slow store answers "allowed" after this, rather than holding the request (decisions Q20). */
export const STORE_TIMEOUT_MS = 1000;

let client: { url: string; redis: Redis } | null = null;
const lastTimeoutLog = new Map<RateLimitPolicy, number>();

function redisFor(store: { url: string; token: string }): Redis {
  if (client?.url !== store.url) client = { url: store.url, redis: new Redis(store) };
  return client.redis;
}

export function upstashLimiter(
  policy: RateLimitPolicy,
  budget: Budget,
  store: { url: string; token: string },
  env: AppEnv,
  now: () => number = Date.now
): RateLimiter {
  const limiter = new Ratelimit({
    redis: redisFor(store),
    limiter: Ratelimit.slidingWindow(budget.requests, `${budget.windowSeconds} s`),
    // Environments sharing a store must not share budgets (decisions Q19).
    prefix: `ratelimit:${env}:${policy}`,
    timeout: STORE_TIMEOUT_MS,
    analytics: false,
  });
  return {
    async limit(key) {
      const { success, limit, remaining, reset, reason } = await limiter.limit(key);
      if (reason === "timeout") {
        // Upstash allows on timeout (fail-open, D3); log once per window, not per request.
        const at = now();
        const last = lastTimeoutLog.get(policy);
        if (last === undefined || at - last >= budget.windowSeconds * 1000) {
          lastTimeoutLog.set(policy, at);
          console.error(`[rate-limit] ${policy}: store timed out after ${STORE_TIMEOUT_MS} ms, request allowed`);
        }
      }
      return { success, limit, remaining, reset };
    },
  };
}

/** For tests: report the next timeout again. */
export function resetTimeoutLog() {
  lastTimeoutLog.clear();
}
