/**
 * How long an outbound call may take before we stop waiting (docs/GTM-READINESS.md B7). A call with
 * no deadline holds a serverless function, and the buyer, until the platform kills both.
 */
export const OUTBOUND_TIMEOUT_MS = {
  /** A small request: an auth call, a lookup, a HEAD. */
  quick: 15_000,
  /** Moves bytes: an object PUT or GET. */
  transfer: 60_000,
} as const;

/** For an SDK that takes no AbortSignal: stops waiting, though the request itself may run on. */
export function withDeadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms} ms`)), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}
