import type { FactKind, FactOf } from "./facts";

/**
 * Where facts go: each owning domain registers its sinks when the worker starts, as job handlers
 * register (ADR-0078 decision 4). Channels hands facts here and imports none of them.
 */

export interface Sink<K extends FactKind = FactKind> {
  /** Names the sink in logs and errors. */
  name: string;
  kind: K;
  /** Lower runs first: inbox stores a message before automations answer it (A-D7). */
  order: number;
  /** Must be idempotent on each fact's `key`: a drain may hand the same fact again. */
  handle(facts: ReadonlyArray<FactOf<K>>): Promise<void>;
}

/**
 * Thrown by a sink when the fact itself can never be handled (it names something that cannot exist):
 * the event counts toward dead. Any other error means the sink was down, and only delays the event.
 */
export class PermanentFactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentFactError";
  }
}

const sinks = new Map<FactKind, Sink[]>();

export function registerSink<K extends FactKind>(sink: Sink<K>): void {
  const list = sinks.get(sink.kind) ?? [];
  if (list.some((existing) => existing.name === sink.name)) throw new Error(`Sink "${sink.name}" is registered twice`);
  list.push(sink as unknown as Sink);
  list.sort((a, b) => a.order - b.order);
  sinks.set(sink.kind, list);
}

export function sinksFor(kind: FactKind): readonly Sink[] {
  return sinks.get(kind) ?? [];
}

/** Test seam: forget every sink. */
export function resetSinks(): void {
  sinks.clear();
}
