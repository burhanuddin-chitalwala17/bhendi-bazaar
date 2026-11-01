import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

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
 * The answer check (D5, inventory-sync Q23): claims listings whose next look is due and runs again
 * only while one is still waiting for its answer. A send starts it; the daily pass restarts it.
 */
export const checkListingsSpec: JobSpec<NoPayload> = { type: "channels.check-listings", schema: noPayload };

/** How often the answer check runs while anything waits, and when each listing is looked at after its send. */
export const LISTING_CHECK_EVERY_SECONDS = 120;
export const LISTING_CHECK_AFTER_SECONDS = [120, 600, 1800, 7200] as const;
