import { z } from "zod";

/**
 * What an org may put on its own banner.
 *
 * The `href` rule is the interesting one (storefront-branding R2c): a banner is a
 * shop's own signage, not advertising space. It may point at this shop's own pages or
 * at a product — never off the platform, and never at another shop. Checked as a shape
 * here and as ownership in the service, because only the service knows whose product
 * a slug names.
 */

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 200;

/** `/store/<handle>` and anything beneath it, or `/product/<slug>`. Nothing else. */
export const BANNER_HREF_PATTERN =
  /^\/(?:store\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9-]+)*(?:\?[^\s]*)?|product\/[a-z0-9][a-z0-9-]*)$/;

export const orgBannerSchema = z.object({
  title: z.string().trim().min(1, "A banner needs a title.").max(TITLE_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).or(z.literal("")).nullish(),
  imageUrl: z.string().url().or(z.literal("")).nullish(),
  imageAlt: z.string().trim().max(TITLE_MAX).or(z.literal("")).nullish(),
  href: z
    .string()
    .trim()
    .regex(
      BANNER_HREF_PATTERN,
      "A banner can only point at your own shop or one of your products."
    )
    .or(z.literal(""))
    .nullish(),
  isActive: z.boolean().default(true),
});

export type OrgBannerFormInput = z.infer<typeof orgBannerSchema>;

export const bannerReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
