import { z } from "zod";
import type { JobSpec } from "./jobs.types";

export const pushStockPayload = z.object({ productId: z.string(), soldOut: z.boolean() });
export type PushStockPayload = z.infer<typeof pushStockPayload>;

/** A sold-out product goes ahead of anything else waiting (inventory-sync Q19). */
const SOLD_OUT_FIRST = 10;

/**
 * "This product's stock changed" (inventory-sync D2), enqueued in the transaction that changed it
 * by catalog's stock repository, so catalog never imports channels. Channels sends the count as it
 * is when the job runs; the handler is in `server/channels/channels.jobs.ts`.
 */
export const pushStockSpec: JobSpec<PushStockPayload> = {
  type: "channels.push-stock",
  schema: pushStockPayload,
  priority: (payload) => (payload.soldOut ? SOLD_OUT_FIRST : undefined),
};
