import { appEnv } from "@server/shared/app-env";
import { HEARTBEAT_STALE_AFTER_SECONDS, JOBS_FAILED_QUEUE } from "./jobs.config";
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
