import type { MetadataRoute } from "next";
import { appUrl } from "@server/shared/app-url";
import { crawlersBlocked } from "@/lib/crawl-block";
import { ROUTES } from "@server/shared/routes";

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
  // Pre-launch: no crawling at all, and no sitemap to advertise (src/lib/crawl-block.ts).
  if (crawlersBlocked()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // `/store` is public and must stay crawlable — it is one letter from `/org` in
      // the line below, and the two read alike. Adding it there would silently
      // de-index every storefront (ADR-0030 decision 3).
      disallow: [
        ROUTES.admin.home,
        ROUTES.org.root,
        "/api/",
        ROUTES.profile,
        ROUTES.orders,
        ROUTES.order(""),
        ROUTES.checkout,
        ROUTES.cart,
        ROUTES.signIn,
        ROUTES.signUp,
        ROUTES.resetPassword,
        ROUTES.forgotPassword,
      ],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
