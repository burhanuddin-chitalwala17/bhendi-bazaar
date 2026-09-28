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

/**
 * What an enqueuer needs to know about a job: its name, its payload's shape and its fairness
 * group — never the handler. A domain exports its spec for the web app to enqueue with and
 * registers the spec plus a handler only where the worker imports it, so the web process runs
 * no handler code and registers nothing.
 */
export type JobSpec<TPayload> = Pick<JobDefinition<TPayload>, "type" | "schema" | "group">;

/** What travels inside a queue row: the type, and the payload the type's schema owns. */
export interface JobEnvelope {
  type: string;
  payload: unknown;
}
