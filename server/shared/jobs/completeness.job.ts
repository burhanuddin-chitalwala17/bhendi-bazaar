import { z } from "zod";
import type { JobSpec } from "./jobs.types";

export const completenessPayload = z.object({
  orgId: z.string(),
  /** Absent: every product of the shop (a channel connected, a map or catalogue changed). */
  productIds: z.array(z.string()).optional(),
});
export type CompletenessPayload = z.infer<typeof completenessPayload>;

/**
 * "These products' completeness may have moved" (listing-model/dynamic-form D3): enqueued by a product save,
 * a channel connected, a field map or a channel's requirements changed, so no page computes it. The handler
 * is in `server/listing/listing.jobs.ts`; catalog and channels enqueue it without importing listing's jobs.
 */
export const completenessSpec: JobSpec<CompletenessPayload> = {
  type: "listing.refresh-completeness",
  schema: completenessPayload,
  group: (payload) => payload.orgId,
};
