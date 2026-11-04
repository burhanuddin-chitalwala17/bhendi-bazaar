import { cache } from "react";
import { bannerRepository } from "@server/catalog/banner.repository";
import { cachedRead, CACHED_READ_EXPIRY } from "@server/shared/read-cache";
import type { HeroBannerContent } from "@/components/home/hero-banner";
import type { AdminBanner } from "@server/catalog/banner.types";
import { toResponsiveImage } from "@server/catalog/image-framing";

export const BANNER_TABLES = ["Banner", "BannerAction"] as const;

/** Row to props. Null columns become absent keys — the banner treats "no eyebrow" and
 *  "empty eyebrow" the same, and only one of them should reach the component. */
export function toHeroBanner(banner: AdminBanner): HeroBannerContent {
  return {
    id: banner.id,
    eyebrow: banner.eyebrow ?? undefined,
    title: banner.title ?? undefined,
    description: banner.description ?? undefined,
    // A URL on the retired store is the same as no image here, not a crash: next/image
    // throws on a host it cannot serve and takes the page with it (OPERATIONS.md).
    image: toResponsiveImage(banner, banner.imageAlt ?? "") ?? undefined,
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
    // Shared across requests (ADR-0065): a banner edit clears it.
    const banners = await cachedRead("active-banners", [], { tables: BANNER_TABLES, seconds: CACHED_READ_EXPIRY.slow }, () =>
      bannerRepository.listActive(),
    );
    return banners.map(toHeroBanner);
  });
}

export const bannersDAL = new BannersDAL();
