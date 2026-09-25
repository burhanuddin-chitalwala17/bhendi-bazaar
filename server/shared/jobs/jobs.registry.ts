import type { JobDefinition, JobEnvelope } from "./jobs.types";

/**
 * The job types the worker knows. Domains register theirs in `*.jobs.ts` files that the
 * worker's entry imports; the web app registers nothing and only enqueues.
 */
const definitions = new Map<string, JobDefinition<unknown>>();

export function registerJob<T>(definition: JobDefinition<T>): JobDefinition<T> {
  if (definitions.has(definition.type)) {
    throw new Error(`Job type "${definition.type}" is registered twice`);
  }
  definitions.set(definition.type, definition as JobDefinition<unknown>);
  return definition;
}

export function registeredJobTypes(): string[] {
  return [...definitions.keys()];
}

export class UnknownJobTypeError extends Error {
  constructor(type: string) {
    super(`No handler is registered for job type "${type}"`);
    this.name = "UnknownJobTypeError";
  }
}

/**
 * Turn a queue row's data into a job the worker can run: resolve the type, parse the payload
 * against that type's schema. A malformed envelope or payload is refused here, never handed
 * to a handler.
 */
export function resolveJob(data: unknown): { definition: JobDefinition<unknown>; payload: unknown } {
  const envelope = data as Partial<JobEnvelope> | null;
  if (!envelope || typeof envelope.type !== "string") {
    throw new Error("Job data is not an envelope with a string type");
  }
  const definition = definitions.get(envelope.type);
  if (!definition) throw new UnknownJobTypeError(envelope.type);
  const payload = definition.schema.parse(envelope.payload);
  return { definition, payload };
}

/** Test seam: forget every registration. */
export function resetJobRegistry(): void {
  definitions.clear();
}
