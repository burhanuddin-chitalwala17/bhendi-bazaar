import { z } from "zod";

import { CHANNELS, type Channel } from "@server/shared/channels";
import { ATTRIBUTE_SOURCE, type AttributeSource } from "@server/listing/channel-map.types";
import { FIELD_SOLUTION, ISSUE_CATEGORIES, type FieldSolution, type IssueCategory } from "@server/requests/request.types";

const WORDS_MAX = 1000;

/** A shop's report (setup-requests Q7, Q23, Q24, Q27): its category and words; an error attached when raised from one. */
export const reportIssueSchema = z.object({
  category: z.enum(ISSUE_CATEGORIES as unknown as [IssueCategory, ...IssueCategory[]]),
  words: z.string().trim().min(1, "Say what happened in a line or two.").max(WORDS_MAX, "Keep it under 1,000 characters."),
  productId: z.string().min(1).max(64).nullable(),
  error: z
    .object({
      channel: z.enum(CHANNELS as unknown as [Channel, ...Channel[]]),
      theirCategory: z.string().max(120).nullable(),
      attribute: z.string().max(120).nullable(),
      code: z.string().max(60).nullable(),
      message: z.string().max(300),
    })
    .nullable(),
});
export type ReportIssueInput = z.infer<typeof reportIssueSchema>;

const fieldChoice = z.object({
  attribute: z.string().min(1).max(120),
  solution: z.enum(Object.values(FIELD_SOLUTION) as [FieldSolution, ...FieldSolution[]]),
  fact: z.string().max(60).nullable().optional(),
  source: z.enum(Object.values(ATTRIBUTE_SOURCE) as [AttributeSource, ...AttributeSource[]]).nullable().optional(),
  constant: z.string().max(200).nullable().optional(),
});

/** What the admin does with a ticket (setup-requests Q6, Q11, Q22): the plan's hash is what was seen. */
export const requestActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("apply"), hash: z.string().max(40), theirCategory: z.string().trim().max(120).optional(), fields: z.array(fieldChoice).max(100).optional() }),
  z.object({ action: z.literal("not_now") }),
  z.object({ action: z.literal("mark_fixed") }),
]);
export type RequestActionInput = z.infer<typeof requestActionSchema>;
