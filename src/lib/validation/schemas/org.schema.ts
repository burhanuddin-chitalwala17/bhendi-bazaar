// src/lib/validation/schemas/org.schemas.ts

import { z } from "zod";
import { postalCodeSchema, optionalPhoneSchema } from "./common.schemas";

export const createOrgSchema = z.object({
  // `.trim().toUpperCase()` come first so they apply *before* the pattern is checked.
  // These inputs are styled `className="uppercase"`, which is CSS: it changes how the
  // value looks and not what it is, so typing lowercase used to show TEST-001 on screen
  // and fail as "test-001". Normalising afterwards, as a trailing `.transform`, never
  // ran — the regex had already rejected it.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Code too short")
    .max(20, "Code too long")
    .regex(/^[A-Z0-9-]+$/, "Use letters, numbers and hyphens only"),

  name: z.string().min(3, "Name too short").max(100, "Name too long"),

  email: z.string().email("Invalid email"),

  phone: optionalPhoneSchema,

  contactPerson: z.string().max(100).optional(),

  // Shipping defaults (required)
  defaultPincode: postalCodeSchema,

  defaultCity: z
    .string()
    .min(2, "City name too short")
    .max(100, "City name too long"),

  defaultState: z
    .string()
    .min(2, "State name too short")
    .max(100, "State name too long"),

  defaultAddress: z.string().max(500).optional(),

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

  isActive: z.boolean(),

  description: z.string().max(1000).optional(),
});

export const updateOrgSchema = createOrgSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
