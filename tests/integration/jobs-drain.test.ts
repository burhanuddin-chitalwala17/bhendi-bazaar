/**
 * A burst of jobs enqueued in one transaction drains at the speed of its handlers, not one batch per
 * poll interval (the stock sync turn-on stalled at four jobs every five minutes on production). Runs
 * the worker's real fetch loops against a real queue, on its own queue name.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PgBoss } from "pg-boss";

import { isDisposableDb } from "../helpers/test-db";

const QUEUE = "drain-test";

describe.skipIf(!isDisposableDb)("the worker's fetch loops (local db)", () => {
  let boss: PgBoss;

  beforeAll(async () => {
    const { JOBS_SCHEMA } = await import("@server/shared/jobs/jobs.config");
    boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: JOBS_SCHEMA, max: 2, supervise: false, schedule: false, migrate: false, createSchema: false });
    await boss.start();
    await boss.createQueue(QUEUE);
    await boss.deleteAllJobs(QUEUE);
  });

  afterAll(async () => {
    await boss.deleteAllJobs(QUEUE);
    await boss.deleteQueue(QUEUE);
    await boss.stop({ graceful: false });
  });

  it("runs every job of a burst within seconds, though the poll interval is minutes", async () => {
    const { startWorkLoops } = await import("@server/shared/jobs/jobs.work");
    await boss.insert(QUEUE, Array.from({ length: 12 }, (_, i) => ({ data: { i } })));
    const done = new Set<number>();
    await startWorkLoops(boss, QUEUE, async (job) => void done.add((job.data as { i: number }).i), 2);
    const deadline = Date.now() + 10_000;
    while (done.size < 12 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    expect(done.size).toBe(12);
  }, 20_000);
});
