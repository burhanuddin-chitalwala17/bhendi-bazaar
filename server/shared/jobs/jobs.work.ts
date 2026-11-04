import type { PgBoss } from "pg-boss";
import Manager from "pg-boss/dist/manager.js";
import { JOBS_GROUP_CONCURRENCY, JOBS_INTERVALS, JOBS_LOCAL_CONCURRENCY } from "./jobs.config";

/** The few pg-boss internals the wake rule needs; `tests/unit/jobs-wake.test.ts` fails if an upgrade moves them. */
interface InternalWorker {
  id: string;
  name: string;
  notify(): void;
}
interface InternalManager {
  workers: Map<string, InternalWorker>;
  notifyQueue(name: string): void;
}

/** Which of the worker's own loops are running a job right now, by pg-boss worker id. */
const KEY = Symbol.for("bhendi-bazaar.jobs-busy");
const registry = globalThis as unknown as { [KEY]?: Set<string> };
const busy = (): Set<string> => (registry[KEY] ??= new Set());

/**
 * One new job wakes one loop, not all of them (worker-foundation trd.md D3). pg-boss's
 * listener wakes every loop on the queue, so each job cost an empty fetch per idle loop: a billed
 * statement apiece. Picks an idle loop; with none idle, one busy loop, which fetches when it finishes.
 */
export function wakeOneLoopPerJob(): void {
  const proto = Manager.prototype as unknown as InternalManager & { __wakeOne?: true };
  if (proto.__wakeOne) return;
  proto.__wakeOne = true;
  proto.notifyQueue = function (this: InternalManager, name: string) {
    const loops = [...this.workers.values()].filter((w) => w.name === name);
    (loops.find((w) => !busy().has(w.id)) ?? loops[0])?.notify();
  };
}

/**
 * The worker's fetch loops: one per slot, each fetching again at once after it ran a job. pg-boss
 * otherwise waits out its poll after every fetch, and a burst enqueued in one transaction wakes it
 * only once, so 43 stock sends drained four every five minutes. A loop that takes a job wakes one
 * idle sibling, so a burst still spreads across every slot while a lone job wakes no one else.
 */
export async function startWorkLoops(
  boss: Pick<PgBoss, "work" | "notifyWorker">,
  queue: string,
  handle: (job: { id: string; data: unknown }) => Promise<void>,
  slots = JOBS_LOCAL_CONCURRENCY,
): Promise<string[]> {
  wakeOneLoopPerJob();
  const ids: string[] = [];
  const wakeIdleSibling = (self: string) => {
    const sibling = ids.find((id) => id !== self && !busy().has(id));
    if (sibling) boss.notifyWorker(sibling);
  };
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
        if (jobs.length === 0) return;
        busy().add(workerId);
        wakeIdleSibling(workerId);
        try {
          for (const job of jobs) await handle(job);
        } finally {
          busy().delete(workerId);
        }
        boss.notifyWorker(workerId);
      },
    );
    ids.push(workerId);
  }
  return ids;
}
