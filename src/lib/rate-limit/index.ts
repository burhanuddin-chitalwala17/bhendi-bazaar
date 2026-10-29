/**
 * Rate limiting: the one way a handler is limited (rate-limiting D11). A handler names its
 * route's registry key; the policy, budget and backend follow from it. A refusal is a 429 in
 * the shared envelope, so a form shows it inline (D6).
 */
import type { NextResponse } from "next/server";
import { appEnv } from "@server/shared/app-env";
import { toErrorResponse } from "@/lib/api-error-response";
import { clientAddress } from "./client-address";
import { isDeployed } from "./config";
import { limiterFor } from "./limiter";
import { RateLimitedError } from "./refusal";
import { policyOf, type LimitedRoute } from "./registry";
import type { HeaderSource } from "./types";

export { RateLimitedError, formatTimeRemaining } from "./refusal";
export type { LimitedRoute } from "./registry";
export type { HeaderSource, RateLimiter, RateLimitResult } from "./types";

function deployed(): boolean {
  try {
    return isDeployed(appEnv());
  } catch {
    // An unset APP_ENV in a production build is refused at boot; treat it as deployed here.
    return true;
  }
}

/** The account where one exists, the trusted address otherwise (spec R7). */
export function callerKey(headers: HeaderSource, userId?: string | null): string {
  return userId ? `user:${userId}` : `ip:${clientAddress(headers, deployed())}`;
}

/** The refusal to raise, or null to proceed. For callers that do not answer with JSON. */
export async function checkRateLimit(
  route: LimitedRoute,
  caller: { headers: HeaderSource; userId?: string | null }
): Promise<RateLimitedError | null> {
  const result = await limiterFor(policyOf(route)).limit(
    `${route}|${callerKey(caller.headers, caller.userId)}`
  );
  return result.success ? null : new RateLimitedError(result);
}

/** The 429 to return, or null to proceed. */
export async function limitRequest(
  request: Request,
  route: LimitedRoute,
  options: { userId?: string | null } = {}
): Promise<NextResponse | null> {
  const refusal = await checkRateLimit(route, { headers: request.headers, userId: options.userId });
  return refusal ? toErrorResponse(refusal) : null;
}
