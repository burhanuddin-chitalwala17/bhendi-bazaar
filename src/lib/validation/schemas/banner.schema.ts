import { z } from "zod";
import { BannerActionVariant } from "@prisma/client";

/**
 * The accepted shape of a banner payload. Parsed by the route and used as the admin
 * form's resolver, so the rules shown inline are the rules enforced (ADR-0013).
 *
 * `order` is absent deliberately: it is server-owned. A create appends to the end and
 * the reorder route is the only thing that writes it — accepting it here, even
 * optionally, is how the field a form forgot to send silently resets.
 */

/** "" is what an untouched optional input submits; the column stores null. */
const blankToNull = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));

const action = z.object({
  label: z.string().trim().min(1, "Label is required").max(40),
  // Relative only: an absolute URL here would send a shopper off the storefront from
  // its most prominent surface, and our own origin is never a constant (CLAUDE.md).
  href: z
    .string()
    .trim()
    .min(1, "Destination is required")
    .max(2048)
    .refine((value) => value.startsWith("/"), "Destination must start with /"),
  variant: z.enum(BannerActionVariant).default("PRIMARY"),
});

export const bannerFormSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(120),
  eyebrow: blankToNull(60).default(null),
  description: blankToNull(400).default(null),
  imageUrl: blankToNull(2048).default(null),
  imageAlt: blankToNull(160).default(null),
  isActive: z.boolean().default(true),
  // Two is what the banner lays out; a third would wrap onto its own line on a phone.
  actions: z.array(action).max(2, "A banner takes at most two buttons").default([]),
});

export type BannerFormSchemaInput = z.infer<typeof bannerFormSchema>;

export const reorderBannersSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "Nothing to reorder"),
});
