import { z } from "zod";

/** Stock sync's switch for one marketplace (inventory-sync D6, Q4): "on" only after the preview. */
export const stockSyncChangeSchema = z.object({ action: z.enum(["on", "pause", "off"]) });
export type StockSyncChangeInput = z.input<typeof stockSyncChangeSchema>;

/** The owner's location matches (inventory-sync Q15, Q16): each to one of the shop's, or not used. */
export const locationMatchSchema = z.object({
  matches: z
    .array(
      z
        .object({ id: z.string().min(1).max(64), orgAddressId: z.string().min(1).max(64).nullable(), notUsed: z.boolean() })
        .refine((m) => !(m.notUsed && m.orgAddressId), "A location is matched or not used, not both."),
    )
    .min(1)
    .max(50),
});
export type LocationMatchInput = z.input<typeof locationMatchSchema>;
