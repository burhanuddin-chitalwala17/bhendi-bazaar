import type { MetadataRoute } from "next";
import { appUrl } from "@server/shared/app-url";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { productsDAL } from "@/data-access-layer/products.dal";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { crawlersBlocked } from "@/lib/crawl-block";

/** Rebuilt hourly. A catalogue changes on a human timescale, not per request. */
export const revalidate = 3600;

/**
 * The real URL set, so a crawler learns what exists here rather than inferring it from
 * whatever it remembers of this domain.
 *
 * `lastModified` is deliberately absent: the storefront's domain types do not carry an
 * updated timestamp, and a fabricated date is worse than none — it teaches a crawler to
 * distrust the whole file.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pre-launch: crawlers that already know this URL keep polling it, so answer
  // with an empty set rather than the catalogue (src/lib/crawl-block.ts).
  if (crawlersBlocked()) {
    return [];
  }

  const origin = appUrl();

  const [categories, productSlugs, shops] = await Promise.all([
    categoriesDAL.getCategories(),
    productsDAL.listSlugs(),
    // Live shops only, and only those with something to sell — a withdrawn org is
    // absent from `listShops` by its where clause, so a closed shop leaves the sitemap
    // without anything here having to remember to remove it (storefront-discovery R3).
    storefrontDAL.listShops(),
  ]);

  return [
    // `/s` is absent: a result page is followed, never offered for ranking (seo R8).
    { url: origin, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/offers`, changeFrequency: "daily", priority: 0.7 },
    { url: `${origin}/sell`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/policies`, changeFrequency: "monthly", priority: 0.3 },
    ...categories.map((category) => ({
      url: `${origin}/category/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...productSlugs.map((slug) => ({
      url: `${origin}/product/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    {
      url: `${origin}/store`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    },
    ...shops.flatMap((shop) => [
      {
        url: `${origin}/store/${shop.handle}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
      },
      // A themed shop's /about is a permanent redirect to its landing page; its goods are at /shop (D6).
      shop.themed
        ? { url: `${origin}/store/${shop.handle}/shop`, changeFrequency: "daily" as const, priority: 0.7 }
        : { url: `${origin}/store/${shop.handle}/about`, changeFrequency: "monthly" as const, priority: 0.4 },
    ]),
  ];
}
