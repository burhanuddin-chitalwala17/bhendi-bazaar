import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

export const listingFactsPayload = z.object({ orgId: z.string(), listingId: z.string() });
export type ListingFactsPayload = z.infer<typeof listingFactsPayload>;

/** Reading one linked listing and filling its product (marketplace-facts D7). The handler is in channels.jobs.ts. */
export const listingFactsSpec: JobSpec<ListingFactsPayload> = {
  type: "channels.fill-facts",
  schema: listingFactsPayload,
  group: (payload) => payload.orgId,
};
