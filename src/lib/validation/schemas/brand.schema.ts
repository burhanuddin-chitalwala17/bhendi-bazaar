import { z } from "zod";
import { COUNTRY_CODES } from "@server/shared/countries";

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value);

/**
 * A brand an org sells (org-profile spec R3). Only the name is required: manufacturer, packer
 * or importer and origin are asked for when a channel needs them, never here (R5, trd D5).
 * Parsed by the org routes and used as the form's resolver (ADR-0013).
 *
 * Two envelopes: create turns a blank into null; update leaves an absent field absent, so a
 * PATCH cannot clear what it did not mention.
 */
const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => value || null);
const patchText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));

/** A country of origin is an ISO code, the form a marketplace asks for it in; blank is "not set". */
const countryOrBlank = z
  .preprocess(trimmed, z.enum(COUNTRY_CODES).or(z.literal("")))
  .nullish()
  .transform((value) => value || null);
const countryPatch = z
  .preprocess(trimmed, z.enum(COUNTRY_CODES).or(z.literal("")))
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null));

const rules = {
  name: z.string().trim().min(1, "Give the brand a name").max(80, "Keep the name under 80 characters"),
  isDefault: z.boolean(),
};

export const brandSchema = z.object({
  name: rules.name,
  manufacturer: optionalText(120),
  packerOrImporter: optionalText(120),
  countryOfOrigin: countryOrBlank,
  isDefault: rules.isDefault.default(false),
});

export type BrandFormValues = z.input<typeof brandSchema>;
export type BrandInput = z.output<typeof brandSchema>;

export const updateBrandSchema = z.object({
  name: rules.name.optional(),
  manufacturer: patchText(120),
  packerOrImporter: patchText(120),
  countryOfOrigin: countryPatch,
  isDefault: rules.isDefault.optional(),
});
