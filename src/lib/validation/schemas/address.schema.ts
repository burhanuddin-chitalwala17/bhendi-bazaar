import { z } from "zod";
import { postalCodeSchema } from "./common.schemas";

/**
 * Validation schema for adding a new address
 */
export const addAddressSchema = z.object({
  id: z.string(),
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be less than 100 characters"),
  mobile: z
    .string()
    .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
  addressLine1: z
    .string()
    .min(5, "Address line 1 must be at least 5 characters")
    .max(200, "Address line 1 must be less than 200 characters"),
  addressLine2: z
    .string()
    .max(200, "Address line 2 must be less than 200 characters")
    .optional(),
  landmark: z
    .string()
    .max(100, "Landmark must be less than 100 characters")
    .optional(),
  city: z
    .string()
    .min(2, "City must be at least 2 characters")
    .max(100, "City must be less than 100 characters"),
  state: z
    .string()
    .min(2, "State must be at least 2 characters")
    .max(100, "State must be less than 100 characters"),
  pincode: postalCodeSchema,
  country: z
    .string()
    .min(2, "Country must be at least 2 characters")
    .max(100, "Country must be less than 100 characters")
    .default("India"),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Validation schema for updating an address
 * All fields are optional for PATCH
 */
export const updateAddressSchema = addAddressSchema.partial();

/**
 * Type inference
 */
export type AddAddressInput = z.infer<typeof addAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;