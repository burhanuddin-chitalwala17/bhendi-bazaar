import { z } from "zod";
import { optionalNumber } from "./common.schemas";
import { COUNTRY_CODES } from "@server/shared/countries";

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : value);

/**
 * An org's listing defaults (org-profile spec R4): origin, tax rate as a percent, and a tax
 * code per category it sells in. Nothing is required — defaults pre-fill and never validate.
 * The service turns the percent into basis points and the list into the stored map.
 */
export const listingDefaultsSchema = z.object({
  countryOfOrigin: z
    .preprocess(trimmed, z.enum(COUNTRY_CODES).or(z.literal("")))
    .nullish()
    .transform((value) => value || null),
  taxRatePercent: optionalNumber(
    z.number().min(0, "A tax rate cannot be negative").max(100, "A tax rate is at most 100%"),
  ),
  taxCodes: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        taxCode: z.string().trim().max(40, "Keep the code under 40 characters"),
      }),
    )
    .max(200)
    .default([]),
});

export type ListingDefaultsFormValues = z.input<typeof listingDefaultsSchema>;
export type ListingDefaultsParsed = z.output<typeof listingDefaultsSchema>;
