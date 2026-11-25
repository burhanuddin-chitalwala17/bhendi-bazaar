import { z } from "zod";
import { REPLY_TEXT_MAX } from "@server/inbox/inbox-send.types";

/**
 * A member's reply (social-selling inbox-core D6; R5, Q5): text up to 1,000 characters and, optionally,
 * one picture from the shop's library. `clientId` is made by the box once per reply, so a double tap
 * sends once.
 */
export const replySchema = z
  .object({
    clientId: z.string().uuid(),
    text: z.string().trim().max(REPLY_TEXT_MAX, "Up to 1,000 characters.").default(""),
    mediaId: z.string().min(1).max(64).optional(),
  })
  .refine((reply) => reply.text.length > 0 || reply.mediaId !== undefined, { message: "Write a reply or add a picture.", path: ["text"] });
export type ReplyInput = z.infer<typeof replySchema>;
