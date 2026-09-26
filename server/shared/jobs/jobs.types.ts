import type { ZodType } from "zod";

/**
 * A job type: a name, the shape of its payload, and what to do with one.
 *
 * The payload is parsed before the handler runs — a job body is untrusted input like a
 * request body (Invariant 4) — and `group` names the organisation whose fairness bucket
 * the job counts against (spec R4). Handlers must be idempotent on `jobId`: delivery is at
 * least once (ADR-0038 D4).
 */
export interface JobDefinition<TPayload> {
  type: string;
  schema: ZodType<TPayload>;
  /** The organisation this job belongs to, for per-org concurrency. Omit for platform work. */
  group?: (payload: TPayload) => string | undefined;
  handler: (job: { jobId: string; payload: TPayload }) => Promise<void>;
}

/** What travels inside a queue row: the type, and the payload the type's schema owns. */
export interface JobEnvelope {
  type: string;
  payload: unknown;
}
