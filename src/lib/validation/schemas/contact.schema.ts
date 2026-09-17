import { z } from "zod";
import { emailSchema } from "./common.schemas";

/**
 * Contact us — shared by the form and `POST /api/contact`, so what a sender sees inline
 * cannot drift from what the server enforces (ADR-0013).
 *
 * Two shapes because the reply address has two sources: a signed-in sender's comes
 * from their session, so they are never asked for it; a guest has to type one.
 */
export const contactMessageSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, "Add a subject")
    .max(120, "Subject is too long"),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least 10 characters")
    .max(2000, "Please keep it under 2000 characters"),
});

export const guestContactMessageSchema = contactMessageSchema.extend({
  email: emailSchema,
});

export type ContactMessageFormValues = z.infer<typeof contactMessageSchema>;
export type GuestContactMessageFormValues = z.infer<typeof guestContactMessageSchema>;
