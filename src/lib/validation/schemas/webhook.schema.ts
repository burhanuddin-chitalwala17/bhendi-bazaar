/**
 * What a carrier's webhook must contain before we act on it (Invariant 4).
 *
 * A webhook body is the least trusted input the store takes: nothing authenticates it today
 * ([BACKLOG.md](../../../../docs/BACKLOG.md)), so the *only* thing standing between a stranger's
 * POST and a shipment moving is what the handler checks. It used to check nothing — the payload
 * went to the provider adapter as `any`, which cast it and read `awb` and `shipment_status` off
 * whatever arrived.
 *
 * Deliberately minimal: the three fields this route dereferences, and no attempt to describe
 * Shiprocket's whole payload, which is theirs to change. Anything else rides through in
 * `rawPayload` and is logged, not branched on.
 */
import { z } from "zod";

export const shiprocketWebhookSchema = z.object({
  awb: z.string().trim().min(1).max(64),
  shipment_status: z.string().trim().min(1).max(120),
  order_id: z.union([z.string().trim().min(1).max(64), z.number()]).optional(),
});

export type ShiprocketWebhookBody = z.infer<typeof shiprocketWebhookSchema>;
