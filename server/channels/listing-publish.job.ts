import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";
import { enqueueLater, type EnqueueTx } from "@server/shared/jobs/jobs.enqueue";

/**
 * Publishing's jobs (marketplace-publish D4, D5). The handlers are in channels.jobs.ts, which only the
 * worker imports.
 */

const publishPayload = z.object({ listingId: z.string().min(1), orgId: z.string().min(1) });
type PublishPayload = z.infer<typeof publishPayload>;

/** One listing's reviewed changes, sent under its lock; grouped per shop for fairness (ADR-0038). */
export const publishListingSpec: JobSpec<PublishPayload> = {
  type: "channels.publish-listing",
  schema: publishPayload,
  group: (payload) => payload.orgId,
};

const noPayload = z.object({});
type NoPayload = z.infer<typeof noPayload>;

/**
 * The answer check (D5, Q22, inventory-sync Q23): claims listings whose next look is due and runs again
 * when the next one falls due, only while one is still waiting. A send starts it; the daily pass restarts it.
 */
export const checkListingsSpec: JobSpec<NoPayload> = { type: "channels.check-listings", schema: noPayload };

/**
 * The shortest gap between two answer checks, and the slot in which only one may be queued: a check
 * runs when the next look falls due (Q22), never sooner than this. And when each listing is looked at.
 */
export const LISTING_CHECK_EVERY_SECONDS = 120;
export const LISTING_CHECK_AFTER_SECONDS = [120, 600, 1800, 7200] as const;

/**
 * Queue the answer check to run in `afterSeconds` (Q22). Keyed by the two-minute slot it will run in,
 * so a send's first look two minutes out is never merged into a run queued an hour ahead, while
 * two calls aiming at the same moment still collapse into one.
 */
export function enqueueListingCheck(db: EnqueueTx, afterSeconds: number): Promise<boolean> {
  const runSlot = Math.floor((Date.now() + afterSeconds * 1000) / (LISTING_CHECK_EVERY_SECONDS * 1000));
  return enqueueLater(db, checkListingsSpec, {}, { afterSeconds, onePerSeconds: LISTING_CHECK_EVERY_SECONDS, slot: String(runSlot) });
}
