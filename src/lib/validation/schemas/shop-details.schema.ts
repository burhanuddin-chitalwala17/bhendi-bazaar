import { z } from "zod";

import {
  LOCATION_MAX,
  OWNER_NAME_MAX,
  OWNER_QUOTE_MAX,
  OWNER_ROLE_MAX,
  TAGLINE_MAX,
  optionalText,
  socialSchema,
} from "@/lib/validation/schemas/storefront.schema";
import {
  ABOUT_MAX,
  PROMISE_NOTE_MAX,
  RETURNS_PRESETS,
  SHOP_DETAILS_SECTION,
} from "@server/catalog/shop-details.types";
import { openShopSchema } from "@/lib/validation/schemas/org.schema";

/**
 * One Shop details save (org-profile D3, Q17, Q21): a section and only its own fields, plus the
 * version the page read. Strict, so a field from another section — or code, GST, pillars — is
 * refused, never quietly written. Every field is optional: a blank never blocks a save (A6).
 */
const version = { expectedUpdatedAt: z.iso.datetime() };
const imageUrl = z.string().url().or(z.literal("")).nullish();

export const essentialsSectionSchema = z.strictObject({
  section: z.literal(SHOP_DETAILS_SECTION.ESSENTIALS),
  tagline: optionalText(TAGLINE_MAX),
  logoUrl: imageUrl,
  ...version,
});

export const aboutSectionSchema = z.strictObject({
  section: z.literal(SHOP_DETAILS_SECTION.ABOUT),
  about: z
    .string()
    .trim()
    .max(ABOUT_MAX, "Keep it to 4,000 letters. Cut a little and save again.")
    .or(z.literal(""))
    .nullish(),
  ...version,
});

export const placeSectionSchema = z.strictObject({
  section: z.literal(SHOP_DETAILS_SECTION.PLACE),
  location: optionalText(LOCATION_MAX),
  ...version,
});

export const personSectionSchema = z.strictObject({
  section: z.literal(SHOP_DETAILS_SECTION.PERSON),
  ownerName: optionalText(OWNER_NAME_MAX),
  ownerRole: optionalText(OWNER_ROLE_MAX),
  ownerQuote: optionalText(OWNER_QUOTE_MAX),
  ownerPhotoUrl: imageUrl,
  ...version,
});

export const socialSectionSchema = z.strictObject({
  section: z.literal(SHOP_DETAILS_SECTION.SOCIAL),
  social: socialSchema,
  ...version,
});

export const promiseSectionSchema = z.strictObject({
  section: z.literal(SHOP_DETAILS_SECTION.PROMISE),
  returnsPreset: z.enum(RETURNS_PRESETS),
  promiseNote: z
    .string()
    .trim()
    .max(PROMISE_NOTE_MAX, "Keep the note to 280 letters.")
    .or(z.literal(""))
    .nullish(),
  ...version,
});

export const shopDetailsSectionSchema = z.discriminatedUnion("section", [
  essentialsSectionSchema,
  aboutSectionSchema,
  placeSectionSchema,
  personSectionSchema,
  socialSectionSchema,
  promiseSectionSchema,
]);

export type ShopDetailsSectionInput = z.infer<typeof shopDetailsSectionSchema>;
export type EssentialsSectionInput = z.infer<typeof essentialsSectionSchema>;
export type AboutSectionInput = z.infer<typeof aboutSectionSchema>;
export type PlaceSectionInput = z.infer<typeof placeSectionSchema>;
export type PersonSectionInput = z.infer<typeof personSectionSchema>;
export type SocialSectionInput = z.infer<typeof socialSectionSchema>;
export type PromiseSectionInput = z.infer<typeof promiseSectionSchema>;

/**
 * Name, mobile and email on Shop details (org-profile D7): the same rules a shop opened with, each
 * optional so one row saves alone, plus the org's version. Strict, so code, GST, the handle or
 * anything server-owned is refused (Invariant 4).
 */
export const shopContactSchema = z
  .strictObject({
    name: openShopSchema.shape.name.optional(),
    phone: openShopSchema.shape.phone.optional(),
    email: openShopSchema.shape.email.optional(),
    ...version,
  })
  .refine((body) => body.name !== undefined || body.phone !== undefined || body.email !== undefined, {
    message: "Nothing to save.",
  });
export type ShopContactInput = z.infer<typeof shopContactSchema>;
export type ShopContactFormInput = z.input<typeof shopContactSchema>;
