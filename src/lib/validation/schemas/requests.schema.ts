import { z } from "zod";

import { ISSUE_CATEGORIES, type IssueCategory } from "@server/requests/request.types";

const WORDS_MAX = 1000;

/** A shop's report (setup-requests Q7, Q23, Q24, Q27): its category and words; an error attached when raised from one. */
export const reportIssueSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES as unknown as [IssueCategory, ...IssueCategory[]]),
  words: z.string().trim().min(1, "Say what happened in a line or two.").max(WORDS_MAX, "Keep it under 1,000 characters."),
  productId: z.string().min(1).max(64).nullable(),
  /** The error a report came from, any module's, as its source said it (setup-requests D4). */
  error: z
    .object({
      source: z.string().max(60).nullable(),
      context: z.string().max(120).nullable(),
      code: z.string().max(60).nullable(),
      subject: z.string().max(120).nullable(),
      message: z.string().max(300),
    })
    .nullable(),
});
export type ReportIssueInput = z.infer<typeof reportIssueSchema>;

/** What the admin does with a ticket (setup-requests Q6, Q11, Q22): the plan's hash is what was seen. */
export const requestActionSchema = z.discriminatedUnion("action", [
  // `choice` is the kind's own, parsed by that kind's schema before anything is written (Invariant 4).
  z.object({ action: z.literal("apply"), hash: z.string().max(40), choice: z.record(z.string(), z.unknown()).default({}) }),
  z.object({ action: z.literal("not_now") }),
  z.object({ action: z.literal("mark_fixed") }),
]);
export type RequestActionInput = z.infer<typeof requestActionSchema>;
