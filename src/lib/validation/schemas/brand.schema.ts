import { z } from "zod";
import { COUNTRY_CODES } from "@server/shared/countries";

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value);

/**
 * A brand an org sells (org-profile spec R3). Only the name is required: manufacturer, packer
 * or importer and origin are asked for when a channel needs them, never here (R5, trd D5).
 * Parsed by the org routes and used as the form's resolver (ADR-0013).
 *
 * Two envelopes: create turns a blank into null; update leaves an absent field absent, so a
 * PATCH cannot clear what it did not mention. The maker, packer and importer are the brand's parties
 * (listing-model/attributes D6), each with an address and pincode a marketplace asks.
 */
const optionalText = (max: number) =>
  z.string().trim().max(max).nullish().transform((value) => value || null);

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

/** A pincode is six digits, as India Post writes it; blank is "not given". */
const pincode = z.string().trim().regex(/^(\d{6})?$/, "Six digits").nullish().transform((value) => value || null);

/** Who makes, packs or imports a brand's goods (listing-model/attributes D6; dynamic-form R7): all optional. */
const partySchema = z.object({
  name: optionalText(120),
  address: optionalText(300),
  pincode,
});
const partiesSchema = z.object({ maker: partySchema, packer: partySchema, importer: partySchema });
export type BrandPartiesInput = z.output<typeof partiesSchema>;

const rules = {
  name: z.string().trim().min(1, "Give the brand a name").max(80, "Keep the name under 80 characters"),
  isDefault: z.boolean(),
};

export const brandSchema = z.object({
  name: rules.name,
  countryOfOrigin: countryOrBlank,
  isDefault: rules.isDefault.default(false),
  /** Registered on Amazon; false lists its products there as Generic (parent Q10). */
  amazonRegistered: z.boolean().default(true),
  // Only the name is required (spec A5): a brand made without parties has none yet.
  parties: partiesSchema.default({
    maker: { name: null, address: null, pincode: null },
    packer: { name: null, address: null, pincode: null },
    importer: { name: null, address: null, pincode: null },
  }),
});

export type BrandFormValues = z.input<typeof brandSchema>;
export type BrandInput = z.output<typeof brandSchema>;

export const updateBrandSchema = z.object({
  name: rules.name.optional(),
  countryOfOrigin: countryPatch,
  isDefault: rules.isDefault.optional(),
  amazonRegistered: z.boolean().optional(),
  /** The three parties together: a form saves all three, so one absent stays as it was. */
  parties: partiesSchema.optional(),
});
