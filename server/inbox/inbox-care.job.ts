import { z } from "zod";
import { enqueueLater, type EnqueueTx } from "@server/shared/jobs/jobs.enqueue";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

/**
 * The inbox's own timed work (D5, D10), woken when there is something to do rather than on a
 * schedule slot (all four are taken, social-selling A-D10). Handlers are in inbox.jobs.ts.
 */

const noPayload = z.object({});
type NoPayload = z.infer<typeof noPayload>;

export const waitingSweepSpec: JobSpec<NoPayload> = { type: "inbox.waiting", schema: noPayload };
export const retentionSpec: JobSpec<NoPayload> = { type: "inbox.retention", schema: noPayload };

/** A thread waits once its newest message from the person is this old (R10, A6). */
export const WAITING_MS = 4 * 60 * 60 * 1000;
/** Due times are gathered into slots this wide, each swept at its end; repeats are harmless (a claim is once). */
const SLOT_MS = 10 * 60 * 1000;
const DAY_SECONDS = 24 * 60 * 60;

/** Wake the waiting sweep when a thread whose person last wrote at `inboundAt` will be waiting. */
export async function waitingAfterArrival(tx: EnqueueTx, inboundAt: Date, now = new Date()): Promise<void> {
  const slot = Math.floor((inboundAt.getTime() + WAITING_MS) / SLOT_MS);
  const afterSeconds = Math.max(0, Math.ceil(((slot + 1) * SLOT_MS - now.getTime()) / 1000));
  await enqueueLater(tx, waitingSweepSpec, {}, { afterSeconds, onePerSeconds: SLOT_MS / 1000, slot: String(slot) });
}

/** Wake the sweep again now, for threads already due that the last run's ceiling left. */
export async function waitingBacklog(tx: EnqueueTx, now = new Date()): Promise<void> {
  await enqueueLater(tx, waitingSweepSpec, {}, { afterSeconds: 60, onePerSeconds: 60, slot: `backlog:${now.getTime()}` });
}

/** Retention daily (D10): each run queues the next day's; the sweep's wake may add a second run, which deletes nothing new. */
export async function retentionDaily(tx: EnqueueTx, afterSeconds: number, now = new Date()): Promise<void> {
  const day = new Date(now.getTime() + afterSeconds * 1000).toISOString().slice(0, 10);
  await enqueueLater(tx, retentionSpec, {}, { afterSeconds, onePerSeconds: DAY_SECONDS, slot: day });
}

export const RETENTION_EVERY_SECONDS = DAY_SECONDS;
