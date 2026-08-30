/**
 * PARKED — not imported by anything. The live seam is `./index.ts`.
 *
 * An in-process Map, so on serverless each instance keeps its own counts and the real
 * limit is the window times the number of running instances. It also never evicts, so
 * the map grows for the life of the instance. Useful locally; not a production control.
 */
// src/lib/rateLimit.ts

import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max requests per interval
}

interface RateLimitStore {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// In production, use Redis or similar
const rateLimitStore = new Map<string, RateLimitStore>();

/**
 * Simple rate limiter using sliding window
 * For production, use Redis with proper TTL
 */
export function rateLimit(config: RateLimitConfig) {
  const { interval, uniqueTokenPerInterval } = config;

  return {
    check: (identifier: string): { success: boolean; remaining: number; reset: number } => {
      const now = Date.now();
      const store = rateLimitStore.get(identifier);

      // Clean up old entries (simple garbage collection)
      if (rateLimitStore.size > 10000) {
        const expiredKeys: string[] = [];
        rateLimitStore.forEach((value, key) => {
          if (value.resetTime < now) {
            expiredKeys.push(key);
          }
        });
        expiredKeys.forEach((key) => rateLimitStore.delete(key));
      }

      if (!store || store.resetTime < now) {
        // First request or window expired
        rateLimitStore.set(identifier, {
          count: 1,
          resetTime: now + interval,
        });
        return {
          success: true,
          remaining: uniqueTokenPerInterval - 1,
          reset: now + interval,
        };
      }

      // Within window
      if (store.count < uniqueTokenPerInterval) {
        store.count++;
        return {
          success: true,
          remaining: uniqueTokenPerInterval - store.count,
          reset: store.resetTime,
        };
      }

      // Rate limit exceeded
      return {
        success: false,
        remaining: 0,
        reset: store.resetTime,
      };
    },
  };
}

/**
 * Rate limit middleware for API routes
 */
export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  getIdentifier: (req: NextRequest) => string | Promise<string>
): Promise<NextResponse | null> {
  const limiter = rateLimit(config);
  const identifier = await getIdentifier(request);

  const result = limiter.check(identifier);

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: "Too many requests",
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": config.uniqueTokenPerInterval.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": result.reset.toString(),
          "Retry-After": retryAfter.toString(),
        },
      }
    );
  }

  // Add rate limit headers to successful responses
  return null; // Continue processing
}

/**
 * Get identifier for rate limiting
 * Uses user ID if authenticated, IP address otherwise
 */
export function getRateLimitIdentifier(request: NextRequest, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

