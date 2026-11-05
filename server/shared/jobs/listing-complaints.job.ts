import { z } from "zod";
import type { JobSpec } from "./jobs.types";

const complaint = z.object({
  code: z.string().nullable(),
  attribute: z.string().nullable(),
  message: z.string(),
  /** Pinned to a field on the listing page: the shop's own fix, never a ticket. */
  field: z.string().nullable(),
  /** brand or mrp, when the provider can tell (marketplace-publish Q24). */
  need: z.string().nullable(),
});

export const listingComplaintsPayload = z.object({
  /** True for the daily look's standing complaints: they add needs but never reopen a resolved ticket (Q12). */
  standing: z.boolean().default(false),
  complaints: z
    .array(
      z.object({
        orgId: z.string(),
        productId: z.string(),
        channel: z.string(),
        productType: z.string().nullable(),
        kind: z.string().nullable(),
        /** The marketplace type the listing was made under, when we made it; else the product type's publishing one. */
        theirCategory: z.string().nullable(),
        issues: z.array(complaint),
      }),
    )
    .min(1),
});
export type ListingComplaintsPayload = z.infer<typeof listingComplaintsPayload>;

/**
 * "A marketplace refused these listings for these attributes" (setup-requests D5): enqueued by channels
 * wherever an answer lands (a create's check, a send, the daily problems look), one job per batch, so
 * channels never imports requests. The handler, in `server/requests/requests.jobs.ts`, keeps only what
 * the admin can set up and raises one ticket per fix.
 */
export const listingComplaintsSpec: JobSpec<ListingComplaintsPayload> = {
  type: "requests.listing-complaints",
  schema: listingComplaintsPayload,
  retry: { limit: 10, delaySeconds: 60 },
};

/**
 * The daily setup-requests pass (D9): close what is set up, raise missing categories. Enqueued by
 * channels' daily maintain job rather than scheduled, so it costs the idle budget nothing.
 */
export const requestsDailySpec: JobSpec<Record<string, never>> = {
  type: "requests.daily",
  schema: z.object({}) as unknown as JobSpec<Record<string, never>>["schema"],
};
