import type { MetadataRoute } from "next";
import { appUrl } from "@server/shared/app-url";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { productsDAL } from "@/data-access-layer/products.dal";
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

  const [categories, products] = await Promise.all([
    categoriesDAL.getCategories(),
    productsDAL.getProducts({}),
  ]);

  return [
    { url: origin, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/s`, changeFrequency: "weekly", priority: 0.5 },
    ...categories.map((category) => ({
      url: `${origin}/category/${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${origin}/product/${product.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
