/**
 * What a carrier's webhook must contain before we act on it (Invariant 4). It is parsed only after
 * the shared token is checked (order-fulfilment D9). Deliberately minimal: the fields this route
 * reads, not Shiprocket's whole payload, which is theirs to change. The body itself is kept on the
 * conflict row and the call log, not branched on.
 */
import { z } from "zod";

/**
 * Shiprocket's `etd`, "2026-11-06 15:40:19" in India time, as the India calendar day "2026-11-06".
 * Anything else is no estimate rather than a refusal: the status update still applies.
 */
const etdDay = z
  .unknown()
  .optional()
  .transform((v) => {
    if (typeof v !== "string") return null;
    const day = /^(\d{4}-\d{2}-\d{2})(?:[ T]|$)/.exec(v.trim())?.[1];
    if (!day) return null;
    const at = new Date(`${day}T00:00:00Z`);
    return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === day ? day : null;
  });

export const shiprocketWebhookSchema = z.object({
  awb: z.union([z.string().trim().min(1).max(64), z.number().int().safe().transform(String)]),
  shipment_status: z.string().trim().min(1).max(120),
  order_id: z.union([z.string().trim().min(1).max(64), z.number()]).optional(),
  etd: etdDay,
});

/** The body as it arrived, kept for the admin's "Show details" — JSON, not a typed shape. */
export const courierPayloadSchema = z.record(z.string(), z.json());

export type ShiprocketWebhookBody = z.infer<typeof shiprocketWebhookSchema>;
