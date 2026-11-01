/**
 * How long an outbound call may take before we stop waiting (docs/GTM-READINESS.md B7). A call with
 * no deadline holds a serverless function, and the buyer, until the platform kills both.
 */
export const OUTBOUND_TIMEOUT_MS = {
  /** A small request: an auth call, a lookup, a HEAD. */
  quick: 15_000,
  /** Moves bytes of a known small size: an image PUT or GET. */
  transfer: 60_000,
  /** Moves a video's worth of bytes on the worker's own link. */
  bulk: 15 * 60_000,
} as const;

/** The slowest link a transfer is still allowed to be on. Below it, it is stuck, not slow. */
const FLOOR_BYTES_PER_SECOND = 256 * 1024;

/** A transfer's deadline grows with its size: 200 MB at the floor rate is about 13 minutes. */
export function transferTimeoutFor(bytes: number): number {
  return Math.max(OUTBOUND_TIMEOUT_MS.transfer, Math.ceil(bytes / FLOOR_BYTES_PER_SECOND) * 1000);
}

/** For an SDK that takes no AbortSignal: stops waiting, though the request itself may run on. */
export function withDeadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} took longer than ${ms} ms`)), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}
