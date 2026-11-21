import { registerJob } from "@server/shared/jobs";
import { enhancementSpec } from "@server/content/enhancement.job";
import { enhancementService } from "@server/content/enhancement.service";
import { styledService } from "@server/content/styled.service";

/**
 * The run, as the queue performs it (image-enhancement trd D9): grouped by org so one org's batch
 * cannot starve another's, and a plain call into the domain's service — no HTTP between the queue
 * and the code (ADR-0038 D3). Only the worker imports this file.
 */
export const imageEnhanceJob = registerJob({
  ...enhancementSpec,
  // An AI picture takes its own path (improve-with-ai D6); every other run is one of the six tools.
  handler: async ({ jobId, payload }) => {
    if (await styledService.run(payload.enhancementId, jobId)) return;
    await enhancementService.run(payload.enhancementId, jobId);
  },
});
