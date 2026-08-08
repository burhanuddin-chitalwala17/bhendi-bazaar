import { z } from "zod";
import { nameSchema, phoneSchema, postalCodeSchema, safeTextSchema } from "./common.schemas";

/**
 * An org pickup location (stock-locations R1): courier nickname, who answers at
 * pickup, and a postal address complete enough for a courier to collect from.
 * Parsed by the org routes and used as the form's resolver (ADR-0013).
 *
 * One set of rules, two envelopes — `.partial()` keeps `.default()`s firing
 * (the PR-42 lesson), so update declares its own optionals and fires none.
 */
const rules = {
  name: z.string().trim().min(2, "Give the location a name").max(100),
  contactName: nameSchema,
  contactPhone: phoneSchema,
  addressLine1: z.string().trim().min(3, "Street address is required").max(200),
  addressLine2: safeTextSchema.optional(),
  landmark: safeTextSchema.optional(),
  city: z.string().trim().min(2, "City is required").max(100),
  state: z.string().trim().min(2, "State is required").max(100),
  pincode: postalCodeSchema,
  isActive: z.boolean(),
};

export const orgLocationSchema = z.object({
  name: rules.name,
  contactName: rules.contactName,
  contactPhone: rules.contactPhone,
  addressLine1: rules.addressLine1,
  addressLine2: rules.addressLine2,
  landmark: rules.landmark,
  city: rules.city,
  state: rules.state,
  pincode: rules.pincode,
  isActive: rules.isActive.default(true),
});

export type OrgLocationInput = z.infer<typeof orgLocationSchema>;

/** For PATCH — same rules where a field is present, absent fields stay absent. */
export const updateOrgLocationSchema = z.object({
  name: rules.name.optional(),
  contactName: rules.contactName.optional(),
  contactPhone: rules.contactPhone.optional(),
  addressLine1: rules.addressLine1.optional(),
  addressLine2: rules.addressLine2,
  landmark: rules.landmark,
  city: rules.city.optional(),
  state: rules.state.optional(),
  pincode: rules.pincode.optional(),
  isActive: rules.isActive.optional(),
});
