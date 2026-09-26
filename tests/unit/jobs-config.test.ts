/**
 * The worker's idle chatter is budgeted, not defaulted (worker-foundation R8, ADR-0038 D8).
 *
 * pg-boss polls every two seconds by default, and Prisma Postgres bills every poll. The
 * configuration object is the one pg-boss receives, so these assertions are about the real
 * settings: every interval the library exposes is named, each is at least a minute, and the
 * modelled daily total clears the declared ceiling. Mutation-tested by shortening one timer.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  IDLE_OPERATIONS_CEILING_PER_DAY,
  JOBS_GROUP_CONCURRENCY,
  JOBS_INTERVALS,
  JOBS_LOCAL_CONCURRENCY,
  JOBS_POOL_MAX,
  JOBS_SCHEDULE_INTERVALS,
  JOBS_SWITCHES,
  HEARTBEAT_INTERVAL_SECONDS,
  HEARTBEAT_STALE_AFTER_SECONDS,
  estimateIdleOperationsPerDay,
} from "@server/shared/jobs/jobs.config";

const ROOT = resolve(__dirname, "../..");

/** Every `*IntervalSeconds` option pg-boss's own types declare. */
function intervalsPgBossExposes(): string[] {
  const types = readFileSync(resolve(ROOT, "node_modules/pg-boss/dist/types.d.ts"), "utf8");
  const names = new Set<string>();
  for (const [, name] of types.matchAll(/^\s+([a-zA-Z]+IntervalSeconds)\??:/gm)) names.add(name);
  return [...names].sort();
}

describe("the worker's queue configuration", () => {
  it("names every interval pg-boss exposes, so none falls back to a library default", () => {
    const exposed = intervalsPgBossExposes();
    expect(exposed.length).toBeGreaterThan(5);
    const missing = exposed.filter((name) => !(name in JOBS_INTERVALS));
    expect(
      missing,
      "pg-boss exposes intervals JOBS_INTERVALS does not set; an unset one takes the library's " +
        "default, which is seconds:\n" +
        missing.map((m) => `    ${m}`).join("\n"),
    ).toEqual([]);
  });

  it("sets every active interval to at least a minute", () => {
    // pg-boss caps the two cron timers at 45 seconds; they only run while scheduling is on,
    // and scheduling stays off until a schedule exists that has decided how to pay for it.
    const inert = new Set<string>(JOBS_SCHEDULE_INTERVALS);
    for (const [name, seconds] of Object.entries(JOBS_INTERVALS)) {
      if (inert.has(name)) {
        expect(JOBS_SWITCHES.schedule, `${name} is under a minute and scheduling is on`).toBe(false);
        continue;
      }
      expect(seconds, `${name} is shorter than a minute`).toBeGreaterThanOrEqual(60);
    }
  });

  it("keeps an idle worker under the declared daily ceiling", () => {
    const estimate = estimateIdleOperationsPerDay();
    expect(estimate).toBeGreaterThan(0);
    expect(
      estimate,
      `An idle worker would issue about ${estimate} operations a day against a ceiling of ` +
        `${IDLE_OPERATIONS_CEILING_PER_DAY}. Raising the ceiling is a decision (ADR-0038 D8).`,
    ).toBeLessThanOrEqual(IDLE_OPERATIONS_CEILING_PER_DAY);
  });

  it("bounds one organisation below the process, and the process below the connection cap", () => {
    expect(JOBS_GROUP_CONCURRENCY).toBeGreaterThanOrEqual(1);
    expect(JOBS_GROUP_CONCURRENCY).toBeLessThan(JOBS_LOCAL_CONCURRENCY);
    // Five direct connections exist; the worker takes its pool plus one for notify.
    expect(JOBS_POOL_MAX + 1).toBeLessThanOrEqual(5);
  });

  it("calls the worker stale only after it has missed a beat", () => {
    expect(HEARTBEAT_STALE_AFTER_SECONDS).toBeGreaterThan(HEARTBEAT_INTERVAL_SECONDS);
  });
});
