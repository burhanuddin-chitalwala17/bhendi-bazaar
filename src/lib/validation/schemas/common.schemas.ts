import { z } from 'zod';
import { PlatformRole } from "@prisma/client";
import { PINCODE_PATTERN, PINCODE_MESSAGE } from "@server/shared/pincode";

// Email validation
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .min(5, 'Email too short')
  .max(255, 'Email too long');

// Phone validation (Indian format)
export const PHONE_PATTERN = /^[6-9]\d{9}$/;
export const PHONE_MESSAGE = 'Enter a 10-digit Indian mobile number';

export const phoneSchema = z
  .string()
  .regex(PHONE_PATTERN, PHONE_MESSAGE)
  .length(10, 'Phone must be exactly 10 digits');

/**
 * A phone field the user may leave blank. `.optional()` alone is not enough: a form
 * sends `""` for an untouched input, which is a string and fails the pattern — the same
 * defect PR-22 fixed for the product form's pincode.
 */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || PHONE_PATTERN.test(v), PHONE_MESSAGE)
  .optional();

// UUID validation
export const uuidSchema = z
  .string()
  .uuid('Invalid ID format');

// Name validation
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(255, 'Name too long')
  .trim()
  .refine((val) => !/[<>]/.test(val), 'Name contains invalid characters');

// Currency/Price validation — a rupee amount as a human types it. Stored amounts are
// integer paise (Invariant 3); the server converts via rupeesToPaise at its boundary.
export const rupeeAmount = (message = 'Amount') =>
  z
    .number({ message: `${message} is required` })
    .positive(`${message} must be greater than 0`)
    .max(10000000, `${message} exceeds the maximum`)
    .finite()
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
      message: `${message} can have at most two decimal places`,
    });

export const priceSchema = rupeeAmount('Price');

/** An amount already in paise — every stored or wire amount (CONTRACTS.md rule 4). */
export const paiseAmount = z.number().int('Amounts cross the wire as integer paise').min(0);

/**
 * A coupon code as typed. Normalised here — uppercased and trimmed — so the value the
 * engine matches on is the value the database stores, whatever the buyer's keyboard
 * did. The charset is deliberately narrow: codes are read aloud, written on posters
 * and retyped, so anything that survives that is letters, digits and a separator.
 */
export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, 'That code is too short')
  .max(32, 'That code is too long')
  .regex(/^[A-Z0-9][A-Z0-9-]*$/, 'Codes use letters, numbers and hyphens');

// Quantity validation
export const quantitySchema = z
  .number()
  .int('Quantity must be a whole number')
  .positive('Quantity must be positive')
  .max(1000, 'Quantity exceeds maximum');

// Text content validation (prevent XSS)
export const safeTextSchema = z
  .string()
  .max(5000, 'Text too long')
  .trim()
  .refine(
    (val) => !/<script|javascript:|onerror=/i.test(val),
    'Text contains potentially dangerous content'
  );

// URL validation
export const urlSchema = z
  .string()
  .url('Invalid URL')
  .max(2048, 'URL too long')
  .refine(
    (val) => val.startsWith('http://') || val.startsWith('https://'),
    'URL must use HTTP or HTTPS protocol'
  );

// Postal code validation (Indian format)
export const postalCodeSchema = z
  .string()
  .regex(PINCODE_PATTERN, PINCODE_MESSAGE);

/** A pincode field that may be left blank — for optional overrides. */
export const optionalPostalCodeSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || PINCODE_PATTERN.test(v), PINCODE_MESSAGE)
  .optional();

/**
 * A number the user may leave blank.
 *
 * `valueAsNumber` gives NaN for an empty input and `z.number().optional()` rejects
 * NaN, so an untouched optional field fails validation — silently, if the field
 * renders no error. Every spelling of blank becomes absent instead.
 */
export const optionalNumber = (inner: z.ZodType<number>) =>
  z.preprocess(
    (v) => (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
    inner.optional()
  );

// Address validation
export const addressSchema = z.object({
  fullName: nameSchema.optional(),
  name: nameSchema.optional(),
  phone: phoneSchema,
  email: emailSchema.optional(),
  line1: z.string().min(5, 'Address line 1 too short').max(500, 'Address line 1 too long'),
  line2: z.string().max(500, 'Address line 2 too long').optional(),
  city: z.string().min(2, 'City too short').max(100, 'City too long'),
  state: z.string().min(2, 'State too short').max(100, 'State too long').optional(),
  postalCode: postalCodeSchema,
  country: z.string().default('India'),
});

// Pagination validation
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});


/**
 * Whether someone runs the platform. Narrows a string from a query param or a select
 * to the enum the database enforces — Invariant 4: parse at the boundary, never cast.
 */
export const platformRoleSchema = z.enum(PlatformRole);
