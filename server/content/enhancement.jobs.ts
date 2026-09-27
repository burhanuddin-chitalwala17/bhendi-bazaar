import { registerJob } from "@server/shared/jobs";
import { enhancementSpec } from "@server/content/enhancement.job";
import { enhancementService } from "@server/content/enhancement.service";

/**
 * The run, as the queue performs it (image-enhancement trd D9): grouped by org so one org's batch
 * cannot starve another's, and a plain call into the domain's service — no HTTP between the queue
 * and the code (ADR-0038 D3). Only the worker imports this file.
 */
export const imageEnhanceJob = registerJob({
  ...enhancementSpec,
  handler: ({ jobId, payload }) => enhancementService.run(payload.enhancementId, jobId),
});
