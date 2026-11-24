/** A stored Meta event's life (ADR-0084; meta-foundation D3, D4). */
export const META_EVENT_STATE = {
  PENDING: "PENDING",
  DONE: "DONE",
  /** Its sink failed five times; skipped so the shop's other events keep moving. */
  DEAD: "DEAD",
} as const;
export type MetaEventState = (typeof META_EVENT_STATE)[keyof typeof META_EVENT_STATE];

/** What the intake answered, for the route and its tests. */
export interface IntakeResult {
  stored: number;
  duplicates: number;
  unrouted: number;
}
