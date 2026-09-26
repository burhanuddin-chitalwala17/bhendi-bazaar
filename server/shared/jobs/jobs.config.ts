/**
 * Everything pg-boss is told, declared once (worker-foundation D3, ADR-0038 D8): this object is
 * what the worker hands the library and what `tests/unit/jobs-config.test.ts` reads, so a
 * shortened timer or an interval left to a library default fails CI before it costs money.
 */

export const JOBS_SCHEMA = "pgboss";
/** One queue, one poll loop; the job type travels inside the job (D3). */
export const JOBS_QUEUE = "jobs";
/** Where a job lands after its retries are spent, for admin to read and re-run (D5). */
export const JOBS_FAILED_QUEUE = "jobs_failed";

/** How many jobs one organisation may have running at once (spec R4). */
export const JOBS_GROUP_CONCURRENCY = 2;
/** How many jobs the worker process runs at once across all organisations. */
export const JOBS_LOCAL_CONCURRENCY = 4;

/** How often the worker writes its heartbeat row, and when admin calls it stale (spec R5). */
export const HEARTBEAT_INTERVAL_SECONDS = 300;
export const HEARTBEAT_STALE_AFTER_SECONDS = 600;

/**
 * Every pg-boss timer, in seconds, in minutes wherever the library allows. Two are capped by
 * pg-boss — the clock monitor at ten minutes, the cron pair at 45 seconds. The cron pair is inert
 * while `schedule` is off, and its cap is why the first schedule (spec PR 3) will be an
 * in-process timer that enqueues a job rather than pg-boss's scheduler.
 */
export const JOBS_INTERVALS = {
  /** Base fetch poll, used while the notify channel is unavailable. */
  pollingIntervalSeconds: 180,
  /** Backstop poll while notify is healthy; notify wakes the worker immediately. */
  notifyPollingIntervalSeconds: 300,
  monitorIntervalSeconds: 1800,
  superviseIntervalSeconds: 900,
  maintenanceIntervalSeconds: 86_400,
  queueCacheIntervalSeconds: 1800,
  clockMonitorIntervalSeconds: 600,
  cronMonitorIntervalSeconds: 45,
  cronWorkerIntervalSeconds: 45,
  bamIntervalSeconds: 1800,
  flowIntervalSeconds: 1800,
  reindexIntervalSeconds: 86_400,
} as const;

/** The intervals pg-boss only runs while `schedule` is on. */
export const JOBS_SCHEDULE_INTERVALS = ["cronMonitorIntervalSeconds", "cronWorkerIntervalSeconds"] as const;

/** The notify listener's own keep-alive, in milliseconds; a ping is a query too. */
export const JOBS_NOTIFY_HEARTBEAT_MS = 600_000;

/**
 * The switches, so a reader sees the whole configuration in one place. Scheduling is off
 * until PR 3 brings the first schedule; reindex and vacuum monitoring are operator work.
 */
export const JOBS_SWITCHES = {
  useListenNotify: true,
  supervise: true,
  schedule: false,
  migrate: false,
  createSchema: false,
  reindex: false,
  monitorVacuum: false,
  persistWarnings: false,
  persistQueueStats: false,
} as const;

/** Direct connections Prisma Postgres leaves us: five. The worker takes three plus notify. */
export const JOBS_POOL_MAX = 3;

/**
 * The daily ceiling for a worker doing nothing (spec R8). Above this a change to the
 * intervals is a decision, not a tweak. Computed from the intervals in the unit test.
 */
export const IDLE_OPERATIONS_CEILING_PER_DAY = 1500;

const SECONDS_PER_DAY = 86_400;

/**
 * A model of what one idle worker asks the database per day: one query per timer tick,
 * counting the fetch poll at its worst (notify unavailable), plus the heartbeat, which is
 * one statement by construction. A model, not a measurement — spec A6 is the measurement.
 */
export function estimateIdleOperationsPerDay(): number {
  const ticks = (seconds: number) => SECONDS_PER_DAY / seconds;
  const i = JOBS_INTERVALS;
  let total = ticks(Math.min(i.pollingIntervalSeconds, i.notifyPollingIntervalSeconds));
  total += ticks(i.monitorIntervalSeconds);
  total += ticks(i.superviseIntervalSeconds);
  total += ticks(i.maintenanceIntervalSeconds);
  total += ticks(i.queueCacheIntervalSeconds);
  total += ticks(i.clockMonitorIntervalSeconds);
  total += ticks(i.bamIntervalSeconds);
  total += ticks(i.flowIntervalSeconds);
  if (JOBS_SWITCHES.schedule) total += ticks(i.cronMonitorIntervalSeconds) + ticks(i.cronWorkerIntervalSeconds);
  if (JOBS_SWITCHES.reindex) total += ticks(i.reindexIntervalSeconds);
  if (JOBS_SWITCHES.useListenNotify) total += ticks(JOBS_NOTIFY_HEARTBEAT_MS / 1000);
  total += ticks(HEARTBEAT_INTERVAL_SECONDS);
  return Math.ceil(total);
}
