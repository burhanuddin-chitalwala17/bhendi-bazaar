import { fromPrisma } from "pg-boss";
import type { Prisma } from "@prisma/client";
import { JOBS_QUEUE } from "./jobs.config";
import { jobsClient } from "./jobs.client";
import type { JobEnvelope, JobSpec } from "./jobs.types";

/** The transaction client Prisma hands an interactive `$transaction` callback. */
export type EnqueueTx = Prisma.TransactionClient;

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
  const boss = await jobsClient();
  const id = await boss.send(JOBS_QUEUE, data, {
    db: fromPrisma(tx),
    ...(group ? { group: { id: group } } : {}),
  });
  if (!id) throw new Error(`Job "${definition.type}" was not accepted by the queue`);
  return id;
}
