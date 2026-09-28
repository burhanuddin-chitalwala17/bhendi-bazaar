import { appEnv } from "@server/shared/app-env";
import { prisma } from "@server/shared/prisma";
import { HEARTBEAT_STALE_AFTER_SECONDS, JOBS_FAILED_QUEUE, JOBS_QUEUE, JOBS_SCHEMA } from "./jobs.config";
import { jobsClient } from "./jobs.client";
import { heartbeatRepository } from "./heartbeat.repository";

export interface WorkerStatus {
  environment: string;
  /** Null until the worker has beaten once. */
  lastSeenAt: Date | null;
  version: string | null;
  waiting: number;
  active: number;
  failed: number;
  /** Finished in the 24 hours before the last beat. Completed jobs leave the queue, so this is how work shows. */
  completedDay: number;
  /** Stale means not seen within the declared window, or never (spec A5). */
  stale: boolean;
}

/** What admin reads: the heartbeat row for this environment, judged against the window. */
export async function workerStatus(now: Date = new Date()): Promise<WorkerStatus> {
  const environment = appEnv();
  const row = await heartbeatRepository.read(environment);
  const stale = !row || now.getTime() - row.lastSeenAt.getTime() > HEARTBEAT_STALE_AFTER_SECONDS * 1000;
  return {
    environment,
    lastSeenAt: row?.lastSeenAt ?? null,
    version: row?.version ?? null,
    waiting: row?.waiting ?? 0,
    active: row?.active ?? 0,
    failed: row?.failed ?? 0,
    completedDay: row?.completedDay ?? 0,
    stale,
  };
}

/** Move every parked job back onto the queue. Returns how many moved (spec R3). */
export async function redriveFailedJobs(): Promise<number> {
  const boss = await jobsClient();
  return boss.redrive(JOBS_FAILED_QUEUE);
}

/** One queue row as admin reads it: what it was, where it is, and why it stopped if it did. */
export interface JobSummary {
  id: string;
  type: string;
  /** The queue it sits on — the working one, or the parking one for spent retries. */
  queue: string;
  state: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  attempts: number;
  error: string | null;
}

export interface JobRow {
  id: string;
  name: string;
  state: string;
  data: unknown;
  retry_count: number;
  created_on: Date;
  started_on: Date | null;
  completed_on: Date | null;
  output: unknown;
}

const ERROR_LENGTH = 200;

/** Pure, exported for tests: a queue row to the summary, the error read out of pg-boss's output. */
export function toJobSummary(row: JobRow): JobSummary {
  const envelope = row.data as { type?: unknown } | null;
  const output = row.output as { message?: unknown } | string | null;
  const failed = row.state === "failed" || row.state === "cancelled";
  const rawError = failed
    ? typeof output === "string"
      ? output
      : output && typeof output.message === "string"
        ? output.message
        : output
          ? JSON.stringify(output)
          : null
    : null;
  return {
    id: row.id,
    type: envelope && typeof envelope.type === "string" ? envelope.type : "unknown",
    queue: row.name,
    state: row.state,
    createdAt: row.created_on.toISOString(),
    startedAt: row.started_on ? row.started_on.toISOString() : null,
    completedAt: row.completed_on ? row.completed_on.toISOString() : null,
    attempts: row.retry_count,
    error: rawError ? rawError.slice(0, ERROR_LENGTH) : null,
  };
}

/**
 * The newest jobs on both queues, read from the queue table when admin asks (worker-foundation
 * R5): never stored, never on the page by default — one query per open of the list.
 */
export async function recentJobs(limit = 20): Promise<JobSummary[]> {
  const rows = await prisma.$queryRawUnsafe<JobRow[]>(
    `SELECT id::text AS id, name, state::text AS state, data, retry_count, created_on, started_on, completed_on, output
     FROM ${JOBS_SCHEMA}.job
     WHERE name IN ($1, $2)
     ORDER BY created_on DESC
     LIMIT $3`,
    JOBS_QUEUE,
    JOBS_FAILED_QUEUE,
    limit,
  );
  return rows.map(toJobSummary);
}
