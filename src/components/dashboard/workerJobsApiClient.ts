import { apiRequest } from "@/lib/api-client";
import type { JobSummary } from "@server/shared/jobs";

/** The worker card's two requests: read the recent jobs, re-queue the parked ones. */
export const workerJobsApiClient = {
  list: (signal?: AbortSignal) =>
    apiRequest<{ jobs: JobSummary[] }>("/api/admin/jobs", { signal }).then(({ jobs }) => jobs),

  redriveFailed: () =>
    apiRequest<{ moved: number }>("/api/admin/jobs/redrive", { method: "POST" }),
};
