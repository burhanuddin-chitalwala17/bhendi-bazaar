import type { NextRequest, NextResponse } from "next/server";

/**
 * Rate limiting — currently DETACHED.
 *
 * Nothing here talks to Redis, and nothing imports `@upstash/*`. Every limiter allows
 * every request, so the live request path carries no cache dependency at all while the
 * cache is unwired.
 *
 * This is deliberate rather than accidental. The previous arrangement *looked* like
 * protection and was not: the Upstash limiter allowed everything whenever
 * `KV_REST_API_*` was absent or unreachable, the middleware copy marked itself
 * initialised before its async setup finished, and both derived the caller's identity
 * from a header the caller supplies. A control that silently does nothing is worse than
 * an absent one, because it is budgeted for.
 *
 * **To reconnect:** wire `./upstash` (shared, correct across instances — the one to
 * use) or `./memory` (per-instance, dev only) into the exports below. The
 * implementations are kept intact and unimported; this file is the only edit.
 *
 * Until then, treat these endpoints as unthrottled and say so out loud:
 * `POST /api/auth/signup`, `/api/auth/forgot-password`, `/api/payments/create-order`,
 * `/api/orders*`, `/api/cart*`.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

const allowed = (): RateLimitResult => ({
  success: true,
  limit: 0,
  remaining: 0,
  reset: Date.now(),
});

/** Named so a reader at the call site can see there is no limiter behind it. */
const detached: RateLimiter = { async limit() { return allowed(); } };

export const authRateLimit = detached;
export const paymentRateLimit = detached;
export const orderRateLimit = detached;
export const apiRateLimit = detached;

/** Whether a real limiter is wired. Read it rather than assuming. */
export const RATE_LIMITING_ENABLED = false;

/**
 * The caller's address, for when a limiter is wired again.
 *
 * `x-forwarded-for` is deliberately absent: a client can send that header, so its first
 * entry is attacker-chosen and rotating it defeats any per-IP limit. The platform's own
 * headers are the ones it sets and a request cannot forge.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Prefers the account over the address — an address is shared, an account is not. */
export function getRateLimitIdentifier(
  request: NextRequest,
  userId?: string
): string {
  return userId ? `user:${userId}` : `ip:${getClientIp(request)}`;
}

export function formatTimeRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/**
 * Returns a 429 response to send, or null to continue. Always null while detached.
 * The signature is kept so the call sites do not move when a limiter returns.
 */
export async function withRateLimit(
  request: NextRequest,
  config: { interval: number; uniqueTokenPerInterval: number },
  getIdentifier: (req: NextRequest) => string | Promise<string>
): Promise<NextResponse | null> {
  // Accepted and ignored on purpose — the signature is the seam, so nothing at a call
  // site has to move when a limiter is wired back in.
  void request;
  void config;
  void getIdentifier;
  return null;
}
