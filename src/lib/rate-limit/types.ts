/** The one contract both backends implement (rate-limiting D5). */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds when the caller's window reopens. */
  reset: number;
}

export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

/** What the address seam needs from a request: `Headers`, or an adapter over a plain object. */
export interface HeaderSource {
  get(name: string): string | null;
}
