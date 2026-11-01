import { z } from "zod";
import { registerJob } from "@server/shared/jobs/jobs.registry";
import { registerSchedule } from "@server/shared/jobs/jobs.schedule";
import { JOBS_SCHEDULE_MIN_INTERVAL_SECONDS } from "@server/shared/jobs/jobs.config";
import { runFulfilmentSweep } from "@server/checkout/fulfilment-nudges";

/**
 * The 12 h and 24 h shop nudges and the 24 h-unbooked admin notice (order-fulfilment D18; R3a,
 * R4). Hourly, the schedule floor, so each can be up to an hour late; the 4th of 4 schedules.
 * Idempotent: every notice is unique per (parcel, kind, audience).
 */
export const fulfilmentSweepJob = registerJob({
  type: "fulfilment.sweep",
  schema: z.object({}),
  handler: async ({ jobId }) => {
    const written = await runFulfilmentSweep();
    console.log(
      `[jobs] fulfilment.sweep ${jobId}: shop 12 h ${written.not_ready_12h}, shop 24 h ${written.not_ready_24h}, admin 24 h ready ${written.ready_24h}`,
    );
  },
});

registerSchedule(fulfilmentSweepJob, {}, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS);
