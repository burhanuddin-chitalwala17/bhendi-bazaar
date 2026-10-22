import { z } from "zod";
import type { JobSpec } from "@server/shared/jobs/jobs.types";

/** A new product already has the main photo (Q29) and gains the rest; a match replaces the gallery (D6). */
export const PHOTO_COPY_MODE = { APPEND: "append", REPLACE: "replace" } as const;

export const listingPhotosPayload = z.object({
  orgId: z.string(),
  listingId: z.string(),
  productId: z.string(),
  mode: z.enum([PHOTO_COPY_MODE.APPEND, PHOTO_COPY_MODE.REPLACE]),
  skipFirst: z.boolean(),
});
export type ListingPhotosPayload = z.infer<typeof listingPhotosPayload>;

/** Copying a listing's photos onto its product (product-merge D6). The handler is in channels.jobs.ts. */
export const listingPhotosSpec: JobSpec<ListingPhotosPayload> = {
  type: "channels.copy-listing-photos",
  schema: listingPhotosPayload,
  group: (payload) => payload.orgId,
};
