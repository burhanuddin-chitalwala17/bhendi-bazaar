import { z } from "zod";

const fact = z.string().trim().min(1).max(60);
const value = z.string().trim().min(1).max(120);

/**
 * One command on a product's "Facts from {marketplace}" card (marketplace-facts D8): fill now,
 * answer a question, change or reset a filled fact, skip one, or choose the category its type needs.
 */
export const marketplaceFactsChangeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fill") }),
  z.object({ action: z.literal("answer"), fact, value }),
  z.object({ action: z.literal("change"), fact, value }),
  z.object({ action: z.literal("reset"), fact }),
  z.object({ action: z.literal("skip"), fact, skipped: z.boolean() }),
  z.object({ action: z.literal("category"), categoryId: z.string().trim().min(1).max(60) }),
]);

/** Leaving a listing off, with why when no type of ours fits it (marketplace-facts Q6). An empty body is the owner's own choice. */
export const leaveOffSchema = z.object({ reason: z.enum(["no_type"]).optional() });

export type MarketplaceFactsChangeInput = z.input<typeof marketplaceFactsChangeSchema>;
