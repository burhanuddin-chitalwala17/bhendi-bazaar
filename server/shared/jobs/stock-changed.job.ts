import { z } from "zod";
import type { JobSpec } from "./jobs.types";

export const stockChangedPayload = z.object({
  products: z.array(z.object({ productId: z.string(), soldOut: z.boolean() })).min(1),
});
export type StockChangedPayload = z.infer<typeof stockChangedPayload>;

/** Ahead of other work when any product in it sold out, as a sold-out push is (inventory-sync Q19). */
const SOLD_OUT_FIRST = 10;

/**
 * "These products' stock changed" (inventory-sync D2, Q27): one job per transaction, however many
 * products it touched, enqueued by catalog's stock repository so catalog never imports channels.
 * Channels keeps only the products a marketplace with sync on lists, and queues `channels.push-stock`
 * for each; the handler is in `server/channels/channels.jobs.ts`.
 */
export const stockChangedSpec: JobSpec<StockChangedPayload> = {
  type: "channels.stock-changed",
  schema: stockChangedPayload,
  priority: (payload) => (payload.products.some((p) => p.soldOut) ? SOLD_OUT_FIRST : undefined),
};
