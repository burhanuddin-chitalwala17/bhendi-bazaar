import { cache } from "react";
import { bannerRepository } from "@server/catalog/banner.repository";
import type { HeroBannerContent } from "@/components/home/hero-banner";
import type { AdminBanner } from "@server/catalog/banner.types";

/** Row to props. Null columns become absent keys — the banner treats "no eyebrow" and
 *  "empty eyebrow" the same, and only one of them should reach the component. */
export function toHeroBanner(banner: AdminBanner): HeroBannerContent {
  return {
    id: banner.id,
    eyebrow: banner.eyebrow ?? undefined,
    title: banner.title,
    description: banner.description ?? undefined,
    image: banner.imageUrl
      ? { src: banner.imageUrl, alt: banner.imageAlt ?? "" }
      : undefined,
    actions: banner.actions.map((action) => ({
      label: action.label,
      href: action.href,
      variant: action.variant === "SECONDARY" ? "secondary" : "primary",
    })),
  };
}

class BannersDAL {
  /** The storefront hero, in display order. Inactive banners are invisible here and
   *  still listed in admin, which is what makes a campaign re-runnable. */
  getActiveBanners = cache(async (): Promise<HeroBannerContent[]> => {
    return (await bannerRepository.listActive()).map(toHeroBanner);
  });
}

export const bannersDAL = new BannersDAL();
