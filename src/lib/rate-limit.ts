import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting is a backstop, and a backstop must never become the outage: if the
 * Upstash keys are absent (local dev) or the service is unreachable, requests are
 * allowed through with a warning rather than every auth route 500ing before it can
 * even validate — which is exactly what happened when `authRateLimit.limit()` threw
 * ahead of the error envelope. Fail open, loudly.
 */

const configured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const redis = configured
  ? new Redis({
      url: process.env.KV_REST_API_URL as string,
      token: process.env.KV_REST_API_TOKEN as string,
    })
  : null;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

let warnedUnconfigured = false;

function failOpen(limiter: Ratelimit | null, name: string) {
  return {
    async limit(identifier: string): Promise<RateLimitResult> {
      if (!limiter) {
        if (!warnedUnconfigured) {
          warnedUnconfigured = true;
          console.warn(
            "[rate-limit] KV_REST_API_URL/KV_REST_API_TOKEN not set — rate limiting disabled, requests allowed"
          );
        }
        return { success: true, limit: 0, remaining: 0, reset: Date.now() };
      }
      try {
        return await limiter.limit(identifier);
      } catch (error) {
        console.error(`[rate-limit] ${name} unreachable — allowing request`, error);
        return { success: true, limit: 0, remaining: 0, reset: Date.now() };
      }
    },
  };
}

const make = (name: string, limiter: Parameters<typeof Ratelimit.slidingWindow>) =>
  failOpen(
    redis
      ? new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(...limiter),
          analytics: true,
          prefix: `ratelimit:${name}`,
        })
      : null,
    name
  );

export const authRateLimit = make("auth", [5, "15 m"]);
export const paymentRateLimit = make("payment", [10, "1 m"]);
export const orderRateLimit = make("order", [20, "1 m"]);
export const apiRateLimit = make("api", [100, "1 m"]);

/**
 * Helper to get client IP from request
 */
export function getClientIp(request: Request): string {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  // x-forwarded-for can be a comma-separated list, take the first one
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return cfConnectingIp || realIp || "unknown";
}

/**
 * Format time remaining for user-friendly error message
 */
export function formatTimeRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000);

  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
