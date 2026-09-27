/**
 * The jobs seam (ADR-0038 D1). Domains import from here and nowhere else in `jobs/`;
 * nothing outside this directory imports pg-boss.
 */
export { enqueue, type EnqueueTx } from "./jobs.enqueue";
export { registerJob } from "./jobs.registry";
export type { JobDefinition, JobSpec } from "./jobs.types";
export { workerStatus, redriveFailedJobs, recentJobs, type WorkerStatus, type JobSummary } from "./jobs.service";
