import { z } from "zod";
import { registerJob } from "@server/shared/jobs/jobs.registry";
import { registerSchedule } from "@server/shared/jobs/jobs.schedule";
import { mediaAssetService } from "@server/catalog/media-asset.service";

/** Six hours: a pending row is stale after one, and a retired object waits thirty days, so nothing is urgent. */
export const MEDIA_SWEEP_INTERVAL_SECONDS = 6 * 60 * 60;

/**
 * The library's housekeeping (media-library trd D2, spec R7): drop uploads that never confirmed,
 * and delete the stored object of an image retired past its grace period. Idempotent by
 * construction — each pass acts only on what is stale now — so a repeat is a no-op.
 */
export const mediaSweepJob = registerJob({
  type: "media.sweep",
  schema: z.object({}),
  handler: async ({ jobId }) => {
    const result = await mediaAssetService.sweep();
    console.log(
      `[jobs] media.sweep ${jobId}: pending removed ${result.pending.removed}, kept ${result.pending.kept}; retired objects deleted ${result.retired.deleted}, kept ${result.retired.kept}`,
    );
  },
});

registerSchedule(mediaSweepJob, {}, MEDIA_SWEEP_INTERVAL_SECONDS);
