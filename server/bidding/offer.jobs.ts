import { z } from "zod";
import { registerJob } from "@server/shared/jobs/jobs.registry";
import { registerSchedule } from "@server/shared/jobs/jobs.schedule";
import { offerAdvanceSpec, offerEmailSpec } from "@server/bidding/offer.job";
import { offerService } from "@server/bidding/offer.service";
import { sendOfferEmail } from "@server/bidding/offer-notify";

/** Hourly: the floor the schedule budget allows, and the most an unanswered offer overstays its deadline (winner-offer D4). */
export const OFFER_SWEEP_INTERVAL_SECONDS = 60 * 60;

/**
 * The offer chain as the queue runs it (winner-offer D4, D10). Every handler is idempotent:
 * `advance` decides from locked rows, and the email checks it has not been sent. Only the
 * worker imports this file.
 */
export const offerAdvanceJob = registerJob({
  ...offerAdvanceSpec,
  handler: async ({ jobId, payload }) => {
    const outcome = await offerService.advance(payload.eventId);
    console.log(`[jobs] bidding.offer.advance ${jobId}: ${payload.eventId} ${outcome.kind}`);
  },
});

export const offerEmailJob = registerJob({
  ...offerEmailSpec,
  handler: ({ jobId, payload }) => sendOfferEmail(payload.offerId, jobId),
});

export const offerSweepJob = registerJob({
  type: "bidding.offer.sweep",
  schema: z.object({}),
  handler: async ({ jobId }) => {
    const result = await offerService.sweep();
    console.log(`[jobs] bidding.offer.sweep ${jobId}: advanced ${result.advanced}, completed ${result.completed}`);
  },
});

registerSchedule(offerSweepJob, {}, OFFER_SWEEP_INTERVAL_SECONDS);
