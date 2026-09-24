import { z } from "zod";

/**
 * What an org may put on its own banner.
 *
 * The `href` rule is the interesting one (storefront-branding R2c): a promotion is a
 * shop's own signage, not advertising space. It may point at this shop's own pages or
 * at one of its products — never off the platform, and never at another shop.
 *
 * Two halves in two places. Here: is it link-shaped at all, absolute or relative. In
 * the service: does it name *this* shop, once the absolute form has been reduced to a
 * path — only the service knows the app's own origin and whose product a slug is.
 */

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 200;

/**
 * The path part of a destination: `/store/<handle>` and anything beneath it, or
 * `/product/<slug>`. Nothing else.
 *
 * Only ever matched against a **path**. An org pastes the link out of its address bar,
 * so what arrives is usually absolute — the service reduces that to a path first and
 * stores the path, because a stored `http://localhost:3000/...` is a link that works
 * on one machine and nowhere else (CLAUDE.md: never hardcode our own origin).
 */
export const BANNER_PATH_PATTERN =
  /^\/(?:store\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9-]+)*|product\/[a-z0-9][a-z0-9-]*)$/;

/** Either shape is acceptable to type; the service decides whose shop it names. */
const ABSOLUTE = /^https?:\/\/\S+$/i;

export const orgBannerSchema = z.object({
  // Optional, like the picture and the link: a promotion may be artwork alone, and
  // the service stores a blank one as null so the shop's hero knows it has no words.
  title: z.string().trim().max(TITLE_MAX).or(z.literal("")).nullish(),
  description: z
    .string()
    .trim()
    .max(DESCRIPTION_MAX)
    .or(z.literal(""))
    .nullish(),
  imageUrl: z.string().url().or(z.literal("")).nullish(),
  imageAlt: z.string().trim().max(TITLE_MAX).or(z.literal("")).nullish(),
  href: z
    .string()
    .trim()
    // Shape only. Whether it is *this* shop is an ownership question the client
    // cannot answer, so the service settles it and returns the error on this field.
    .refine(
      (value) => ABSOLUTE.test(value) || BANNER_PATH_PATTERN.test(value),
      "Paste the link to your shop or one of your products.",
    )
    .or(z.literal(""))
    .nullish(),
  isActive: z.boolean().default(true),
});

export type OrgBannerFormInput = z.infer<typeof orgBannerSchema>;

export const bannerReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
