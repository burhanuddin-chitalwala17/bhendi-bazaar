import { z } from "zod";

import { SLUG_PATTERN } from "@server/shared/slug";
import { SOCIAL_NETWORK_KEYS, normaliseHandle } from "@server/catalog/social-networks";
import { HIDEABLE_BRAND_PAGE_SECTIONS } from "@server/catalog/brand-page-sections";
import { PALETTE_KEYS, THEME_KEYS, THEMES } from "@server/catalog/storefront-themes";

/**
 * What an org may send about its own shop.
 *
 * `handle` is deliberately absent from `storefrontSettingsSchema`: it moves a public
 * address and has its own operation and its own schema below (ADR-0030 decision 4).
 * A handle arriving in a settings payload therefore reaches nothing at all, rather
 * than relying on the write to whitelist it — two doors, both shut.
 */

/** Lengths that make a shop page, not a pamphlet (storefront-branding R6). */
export const TAGLINE_MAX = 120;
export const LOCATION_MAX = 120;
/** A person, not a biography: a name, what they do, and one line worth quoting. */
export const OWNER_NAME_MAX = 80;
export const OWNER_ROLE_MAX = 80;
export const OWNER_QUOTE_MAX = 280;

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
export const optionalText = (max: number) =>
  z.string().trim().max(max).or(z.literal("")).nullish();

/**
 * Handles, keyed by network, checked against the same shape the page renders from
 * (brand-page D7). A blank clears that network. A URL is refused here rather than dropped
 * later, so the shop is told, instead of quietly losing what it typed.
 */
export const socialSchema = z
  .partialRecord(z.enum(SOCIAL_NETWORK_KEYS), z.string().trim().max(120))
  .nullish()
  .superRefine((value, ctx) => {
    if (!value) return;
    for (const [network, handle] of Object.entries(value)) {
      if (!handle) continue;
      if (normaliseHandle(network as (typeof SOCIAL_NETWORK_KEYS)[number], handle) === null) {
        ctx.addIssue({
          code: "custom",
          path: [network],
          message: "Use the handle on its own, not a web address.",
        });
      }
    }
  });

/**
 * Looks only (org-profile D3): the shop's facts are written by Shop details, so a fact sent here
 * is refused rather than silently landing in a column two editors share. `pillars` is retired (D5).
 */
export const storefrontSettingsSchema = z.strictObject({
  heroUrl: z.string().url().or(z.literal("")).nullish(),
  accent: z.enum(STOREFRONT_ACCENTS).or(z.literal("")).nullish(),
  hiddenSections: z.array(z.enum(HIDEABLE_BRAND_PAGE_SECTIONS)).nullish(),
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

/**
 * Publish a look (storefront-themes D11): two keys into code and the version the editor saw. A
 * palette must be one of its theme's three (own-store Q15); who and when are the server's.
 */
export const storefrontLookSchema = z
  .object({
    theme: z.enum(THEME_KEYS),
    palette: z.enum(PALETTE_KEYS),
    lookVersion: z.number().int().min(0),
  })
  .strict()
  .refine((look) => THEMES[look.theme].palettes.some((p) => p.key === look.palette), {
    path: ["palette"],
    message: "That palette is not one of this theme's.",
  });
export type StorefrontLookPayload = z.infer<typeof storefrontLookSchema>;

/** Switch back (Q4): only the version the editor saw; what it restores is the server's. */
export const storefrontRevertSchema = z.object({ lookVersion: z.number().int().min(0) }).strict();
