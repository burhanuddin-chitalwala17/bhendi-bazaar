// src/lib/validation/schemas/org.schemas.ts

import { z } from "zod";
import { postalCodeSchema, optionalPhoneSchema } from "./common.schemas";

// `code` is absent deliberately: it is server-generated at creation and then frozen,
// like a slug — an identifier a user invents collides and can never change once
// printed. `isActive` is absent too: a new org is active by definition, and
// deactivation is a platform action, so neither is accepted from a request body
// (Invariant 4, server-owned fields).
export const createOrgSchema = z.object({
  name: z.string().min(3, "Name too short").max(100, "Name too long"),

  email: z.string().email("Invalid email"),

  phone: optionalPhoneSchema,

  contactPerson: z.string().max(100).optional(),


  // Business details (all optional now)
  businessName: z.string().max(200).optional(),

  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GST number format"
    )
    .optional()
    .or(z.literal("")),

  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format")
    .optional()
    .or(z.literal("")),


  description: z.string().max(1000).optional(),
});

export const updateOrgSchema = createOrgSchema.partial().extend({
  id: z.string().min(1),
  // Editable only here: deactivation is an admin act on an existing org.
  isActive: z.boolean().optional(),
});

/**
 * What the shared form renders. The superset of create and update minus server-owned
 * fields: `isActive` is optional because the switch only renders in edit mode, and the
 * create route parses `createOrgSchema`, which strips it.
 */
export const orgFormSchema = createOrgSchema.extend({
  isActive: z.boolean().optional(),
});
export type OrgFormInput = z.infer<typeof orgFormSchema>;

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
