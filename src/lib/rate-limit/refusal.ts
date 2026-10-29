/**
 * A refused request, as a `DomainError` so `toErrorResponse` answers it in the shared
 * envelope with its retry headers (rate-limiting D6, ADR-0013). No limiter imports here:
 * `src/lib/api-error-response.ts` reads this file.
 */
import { DomainError } from "@server/shared/domain-error";
import { refusalMessage } from "./copy";
import type { RateLimitResult } from "./types";

export { formatTimeRemaining } from "./copy";

export class RateLimitedError extends DomainError {
  readonly result: RateLimitResult;

  constructor(result: RateLimitResult, now = Date.now()) {
    super(refusalMessage(result.reset - now), { status: 429 });
    this.name = "RateLimitedError";
    this.result = result;
  }

  headers(now = Date.now()): Record<string, string> {
    return {
      "Retry-After": String(Math.max(1, Math.ceil((this.result.reset - now) / 1000))),
      "X-RateLimit-Limit": String(this.result.limit),
      "X-RateLimit-Remaining": String(this.result.remaining),
      "X-RateLimit-Reset": String(this.result.reset),
    };
  }
}
