import type { MetadataRoute } from "next";
import { appUrl } from "@server/shared/app-url";

/**
 * Crawlers had no statement of what this site is, so they were still working a list
 * from the domain's previous life — a WordPress site whose index Bing is still
 * re-checking years later. This says what to read; the 410 in `src/middleware.ts` says
 * what to forget.
 *
 * Disallow is about pointlessness, not secrecy: every path below is already gated
 * server-side, and a crawler cannot sign in. Listing them stops the crawl budget being
 * spent on redirects to /signin.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/org", "/api/", "/profile", "/orders", "/order/", "/checkout", "/cart", "/signin", "/signup", "/reset-password", "/forgot-password"],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
