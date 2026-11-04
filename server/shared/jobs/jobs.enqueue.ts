import { fromPrisma } from "pg-boss";
import type { Prisma } from "@prisma/client";
import { JOBS_QUEUE } from "./jobs.config";
import { jobsClient } from "./jobs.client";
import type { JobEnvelope, JobSpec } from "./jobs.types";

/** The transaction client Prisma hands an interactive `$transaction` callback. */
export type EnqueueTx = Pick<Prisma.TransactionClient, "$queryRawUnsafe">;

/**
 * Write a job in the caller's transaction (spec R2, ADR-0038 D2).
 *
 * The row is inserted through `tx`, so it commits or rolls back with the business row
 * beside it, and the notify that wakes the worker fires only on commit. The returned id is
 * what the caller stores on its own ledger row so the two are one fact in two tables.
 */
export async function enqueue<T>(
  tx: EnqueueTx,
  definition: JobSpec<T>,
  payload: T,
): Promise<string> {
  const data: JobEnvelope = { type: definition.type, payload: definition.schema.parse(payload) };
  const group = definition.group?.(payload);
  const priority = definition.priority?.(payload);
  const boss = await jobsClient();
  const id = await boss.send(JOBS_QUEUE, data, {
    db: fromPrisma(tx),
    ...(group ? { group: { id: group } } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(definition.retry ? { retryLimit: definition.retry.limit, retryDelay: definition.retry.delaySeconds, retryBackoff: true } : {}),
  });
  if (!id) throw new Error(`Job "${definition.type}" was not accepted by the queue`);
  return id;
}

/**
 * Write one job per payload in the caller's transaction, as one statement (bulk product actions,
 * Q29): the same commit-or-roll-back as `enqueue`, without a round trip per job. pg-boss's `insert`
 * notifies the worker on commit as `send` does.
 */
export async function enqueueMany<T>(tx: EnqueueTx, definition: JobSpec<T>, payloads: readonly T[]): Promise<void> {
  if (payloads.length === 0) return;
  const jobs = payloads.map((payload) => {
    const group = definition.group?.(payload);
    const priority = definition.priority?.(payload);
    const data: JobEnvelope = { type: definition.type, payload: definition.schema.parse(payload) };
    return {
      data,
      ...(group ? { group: { id: group } } : {}),
      ...(priority !== undefined ? { priority } : {}),
      // The same retries `enqueue` gives a spec that asks for them.
      ...(definition.retry ? { retryLimit: definition.retry.limit, retryDelay: definition.retry.delaySeconds, retryBackoff: true } : {}),
    };
  });
  const boss = await jobsClient();
  await boss.insert(JOBS_QUEUE, jobs, { db: fromPrisma(tx) });
}

/**
 * Write a job to run after a delay, at most one per `onePerSeconds` slot for its type: the shape of
 * work that repeats only while there is something to do, so an idle worker pays nothing
 * (inventory-sync Q23). A job already in the slot means this one is not needed: answers false.
 */
export async function enqueueLater<T>(
  tx: EnqueueTx,
  definition: JobSpec<T>,
  payload: T,
  options: { afterSeconds: number; onePerSeconds: number; slot?: string },
): Promise<boolean> {
  const data: JobEnvelope = { type: definition.type, payload: definition.schema.parse(payload) };
  const group = definition.group?.(payload);
  const boss = await jobsClient();
  const id = await boss.send(JOBS_QUEUE, data, {
    db: fromPrisma(tx),
    startAfter: options.afterSeconds,
    // pg-boss slots a singleton by when it is sent, not when it runs; a caller whose runs fall at
    // different times names the run's own slot, so an early run is never swallowed by a later one.
    singletonKey: options.slot ? `later:${definition.type}:${options.slot}` : `later:${definition.type}`,
    singletonSeconds: options.onePerSeconds,
    ...(group ? { group: { id: group } } : {}),
  });
  return id !== null;
}
