import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs";

const id = z.string().trim().min(1).max(64);

export const advancePayload = z.object({ eventId: id });
export type AdvancePayload = z.infer<typeof advancePayload>;

/**
 * One step of an event's offer chain, enqueued at creation to run at `endAt`
 * (winner-offer D4). Platform work, so no fairness group. Handlers are in offer.jobs.ts,
 * which only the worker imports.
 */
export const offerAdvanceSpec: JobSpec<AdvancePayload> = {
  type: "bidding.offer.advance",
  schema: advancePayload,
};
