import { z } from "zod";
import { ContactMessageStatus } from "@prisma/client";
import { emailSchema, nameSchema } from "./common.schemas";

/**
 * Contact us — the one declaration the form and `POST /api/contact` share, so what a
 * sender sees inline cannot drift from what the server enforces
 * ([ADR-0013](../../../../docs/adr/0013-one-error-envelope-and-useserverform.md)).
 *
 * Name and email are required because a signed-out visitor supplies them. For a
 * signed-in sender the server discards both and reads the account instead
 * (docs/specs/contact-us/trd.md D3) — validating them here is about the guest path, not
 * about trusting them.
 */
export const contactMessageSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  /** Optional, and an untouched input sends `""` — hence no `.min(1)`. */
  subject: z.string().trim().max(120, "Subject is too long").optional(),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least 10 characters")
    .max(2000, "Please keep it under 2000 characters"),
});

export type ContactMessageFormValues = z.infer<typeof contactMessageSchema>;

/** What the admin list accepts as query parameters. */
export const contactMessageListSchema = z.object({
  status: z.enum(ContactMessageStatus).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().max(10_000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["createdAt", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/** The one field an admin may change. Everything else on the row is the sender's. */
export const updateContactMessageSchema = z.object({
  status: z.enum(ContactMessageStatus),
});
