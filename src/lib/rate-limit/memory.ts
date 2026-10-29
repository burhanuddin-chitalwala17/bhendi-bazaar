/**
 * The in-process limiter for local development (rate-limiting D1a). Each process keeps its
 * own counts, so it is never the deployed backend. Fixed windows, bounded (D7): at its
 * maximum it sweeps expired windows, then evicts the oldest.
 */
import type { Budget } from "./policies";
import type { RateLimiter, RateLimitResult } from "./types";

export const MEMORY_LIMITER_MAX_KEYS = 10_000;

interface Window {
  count: number;
  reset: number;
}

export function memoryLimiter(
  budget: Budget,
  options: { maxKeys?: number; now?: () => number } = {}
): RateLimiter & { size(): number } {
  const maxKeys = options.maxKeys ?? MEMORY_LIMITER_MAX_KEYS;
  const now = options.now ?? Date.now;
  const windows = new Map<string, Window>();

  function makeRoom(at: number) {
    if (windows.size < maxKeys) return;
    for (const [key, window] of windows) if (window.reset <= at) windows.delete(key);
    // Map iterates in insertion order and a window is re-inserted when it restarts, so the
    // first key is the one whose window began longest ago.
    while (windows.size >= maxKeys) {
      const oldest = windows.keys().next().value;
      if (oldest === undefined) break;
      windows.delete(oldest);
    }
  }

  return {
    size: () => windows.size,
    async limit(key: string): Promise<RateLimitResult> {
      const at = now();
      const current = windows.get(key);
      if (!current || current.reset <= at) {
        windows.delete(key);
        makeRoom(at);
        const reset = at + budget.windowSeconds * 1000;
        windows.set(key, { count: 1, reset });
        return { success: true, limit: budget.requests, remaining: budget.requests - 1, reset };
      }
      if (current.count >= budget.requests) {
        return { success: false, limit: budget.requests, remaining: 0, reset: current.reset };
      }
      current.count += 1;
      return {
        success: true,
        limit: budget.requests,
        remaining: budget.requests - current.count,
        reset: current.reset,
      };
    },
  };
}
