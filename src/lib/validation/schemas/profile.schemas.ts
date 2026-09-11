import { z } from 'zod';
import { nameSchema, emailSchema, phoneSchema, optionalPhoneSchema, uuidSchema, postalCodeSchema } from './common.schemas';

// Profile address schema (includes ID and default flag)
const profileAddressSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(100).optional(),
  fullName: nameSchema, // Required for profile addresses
  mobile: phoneSchema,
  addressLine1: z
    .string()
    .min(5, "Address line 1 too short")
    .max(500, "Address line 1 too long"),
  addressLine2: z.string().max(500, "Address line 2 too long").optional(),
  city: z.string().min(2, "City too short").max(100, "City too long"),
  state: z.string().min(2, "State too short").max(100, "State too long"),
  pincode: postalCodeSchema,
  country: z.string().default("India"),
  isDefault: z.boolean().default(false),
});

// Update profile schema
export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  mobile: phoneSchema.optional(),
  addresses: z.array(profileAddressSchema).max(10, 'Maximum 10 addresses allowed').optional(),
  profilePic: z.string().url().max(2048).optional().or(z.literal('')),
}).refine(
  (data) => {
    // Ensure only one default address
    if (data.addresses) {
      const defaultCount = data.addresses.filter(a => a.isDefault).length;
      return defaultCount <= 1;
    }
    return true;
  },
  { message: 'Only one address can be set as default', path: ['addresses'] }
);

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** The account-details card. Any field may be blank (the card sends only what was filled); a filled one meets the route's own rule. */
export const profileInfoFormSchema = z.object({
  name: z.literal('').or(nameSchema),
  email: z.literal('').or(emailSchema),
  mobile: optionalPhoneSchema,
});

export type ProfileInfoFormInput = z.infer<typeof profileInfoFormSchema>;

