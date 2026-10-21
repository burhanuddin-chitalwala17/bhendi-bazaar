import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

export const listingReadPayload = z.object({ connectionId: z.string(), orgId: z.string() });
export type ListingReadPayload = z.infer<typeof listingReadPayload>;

/**
 * The listing read as the web app enqueues it (channel-import D3): on connect, and on "Read again".
 * The handler lives in channels.jobs.ts, which only the worker imports.
 */
export const listingReadSpec: JobSpec<ListingReadPayload> = {
  type: "channels.read-listings",
  schema: listingReadPayload,
  group: (payload) => payload.orgId,
};
