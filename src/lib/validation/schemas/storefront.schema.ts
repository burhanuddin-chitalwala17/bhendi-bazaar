import { z } from "zod";

import { SLUG_PATTERN } from "@server/shared/slug";

/**
 * What an org may send about its own shop.
 *
 * `handle` is deliberately absent from `storefrontSettingsSchema`: it moves a public
 * address and has its own operation and its own schema below (ADR-0030 decision 4).
 * A handle arriving in a settings payload therefore reaches nothing at all, rather
 * than relying on the write to whitelist it — two doors, both shut.
 */

/** Lengths that make a shop page, not a pamphlet (storefront-branding R6). */
const TAGLINE_MAX = 120;
const ABOUT_MAX = 4000;
const POLICY_MAX = 2000;

/**
 * The accent palette. A closed set of token names, never a colour value — a storefront
 * cannot express a colour the design system does not own (ADR-0022).
 */
export const STOREFRONT_ACCENTS = [
  "primary",
  "success",
  "warning",
  "info",
] as const;
export type StorefrontAccent = (typeof STOREFRONT_ACCENTS)[number];

/** Blank means cleared. Trimmed so whitespace cannot masquerade as content. */
const optionalText = (max: number) =>
  z.string().trim().max(max).or(z.literal("")).nullish();

export const storefrontSettingsSchema = z.object({
  tagline: optionalText(TAGLINE_MAX),
  description: optionalText(ABOUT_MAX),
  logoUrl: z.string().url().or(z.literal("")).nullish(),
  heroUrl: z.string().url().or(z.literal("")).nullish(),
  accent: z.enum(STOREFRONT_ACCENTS).or(z.literal("")).nullish(),
  deliveryPolicy: optionalText(POLICY_MAX),
  returnsPolicy: optionalText(POLICY_MAX),
});

export type StorefrontSettingsInput = z.infer<typeof storefrontSettingsSchema>;

/**
 * A handle change, on its own.
 *
 * Bounded at 40 so an address stays speakable — the point of a handle is that it can be
 * read off a card — and matched against the one slug rule the whole project uses, so a
 * handle and a product slug cannot disagree about what survives a route param.
 */
export const handleChangeSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "An address needs at least two characters.")
    .max(40, "An address that long will not fit on a card.")
    .regex(SLUG_PATTERN, "Use lowercase letters, numbers and hyphens only."),
});

export type HandleChangeInput = z.infer<typeof handleChangeSchema>;
