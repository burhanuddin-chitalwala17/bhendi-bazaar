import type { PgBoss } from "pg-boss";
import { JOBS_GROUP_CONCURRENCY, JOBS_INTERVALS, JOBS_LOCAL_CONCURRENCY } from "./jobs.config";

/**
 * The worker's fetch loops: one per slot, each fetching again at once after it ran a job. pg-boss
 * otherwise waits out its poll after every fetch, and a burst enqueued in one transaction wakes it
 * only once, so 43 stock sends drained four every five minutes. An empty fetch waits as before.
 */
export async function startWorkLoops(
  boss: Pick<PgBoss, "work" | "notifyWorker">,
  queue: string,
  handle: (job: { id: string; data: unknown }) => Promise<void>,
  slots = JOBS_LOCAL_CONCURRENCY,
): Promise<string[]> {
  const ids: string[] = [];
  for (let slot = 0; slot < slots; slot++) {
    let workerId = "";
    workerId = await boss.work(
      queue,
      {
        localConcurrency: 1,
        groupConcurrency: JOBS_GROUP_CONCURRENCY,
        pollingIntervalSeconds: JOBS_INTERVALS.pollingIntervalSeconds,
        notifyPollingIntervalSeconds: JOBS_INTERVALS.notifyPollingIntervalSeconds,
      },
      // batchSize is 1, so this is one job, but pg-boss hands an array.
      async (jobs) => {
        for (const job of jobs) await handle(job);
        if (jobs.length > 0) boss.notifyWorker(workerId);
      },
    );
    ids.push(workerId);
  }
  return ids;
}
