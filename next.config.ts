import type { NextConfig } from "next";
// Relative import: next.config loads before tsconfig path aliases exist.
import { crawlersBlocked } from "./src/lib/crawl-block";
import { SELF_FRAMED_HEADERS, SELF_FRAMED_SOURCE, STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";
import { assertRateLimitConfigAtBuild } from "./src/lib/rate-limit/config";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";

// A preview or production build that cannot enforce rate limits fails here, so the deploy
// never goes live (rate-limiting D2, spec A3).
assertRateLimitConfigAtBuild();

const nextConfig: NextConfig = {
  // Next's own list plus Googlebot, so Google gets the canonical and title in <head> rather than
  // streamed into <body> (docs/GTM-READINESS.md B10). Setting this replaces the default, hence the extension.
  experimental: {
    // Next optimises lucide by default but not Phosphor: without this every icon module is bundled.
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|Googlebot`, "i"),
  async headers() {
    // The per-request Content-Security-Policy is set in src/middleware.ts, which is where
    // the nonce is generated. These are the ones that never vary, applied here so they
    // reach static assets too — middleware does not run for those.
    const headers = [...STATIC_SECURITY_HEADERS];

    // Pre-launch crawl block (src/lib/crawl-block.ts): noindex for bots that
    // skip robots.txt but honour the header. Read once per build, which is when
    // the deployment's env is fixed anyway.
    if (crawlersBlocked()) {
      headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    }

    // Last, so its X-Frame-Options overrides DENY on the look preview alone (storefront-themes D12).
    return [{ source: "/:path*", headers }, { source: SELF_FRAMED_SOURCE, headers: SELF_FRAMED_HEADERS }];
  },
  async redirects() {
    // Addresses Google still holds from before categories lived under /category/
    // (Search Console 404 report, 2026-10-29). Permanent, so the link's standing moves.
    return [
      { source: "/semi-formal-ridas", destination: "/category/semi-formal-rida", permanent: true },
      // The seller page was /sell until 2026-11-05; links already shared keep working.
      { source: "/sell", destination: "/business", permanent: true },
    ];
  },
  // The loader runs in the browser, which has no other way to know which host is ours.
  env: { IMAGE_STORE_BASE_URL: (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "") },
  images: {
    // Not Vercel's optimizer: it bills per transformation and answered 402 once the Hobby
    // quota ran out. Photographs are stored at each width instead, and this picks one (ADR-0075).
    loader: "custom",
    loaderFile: "./src/lib/image/loader.ts",
    // The widths a srcset may name: the stored copies, then the 2048 original (DELIVERY_WIDTHS,
    // MAX_IMAGE_EDGE). A fixed-width image picks from the same list.
    deviceSizes: [320, 800, 1200, 2048],
    imageSizes: [],
    remotePatterns: [
      // Inert under the custom loader; kept as the list of hosts we render, which the CSP's
      // img-src mirrors (src/lib/security-headers.ts).
      ...(process.env.R2_PUBLIC_BASE_URL
        ? [
            {
              protocol: "https" as const,
              hostname: new URL(process.env.R2_PUBLIC_BASE_URL).hostname,
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "placehold.co", // ← Add this for placeholder images
      },
      {
        // Video poster frames, derived from the video id rather than stored
        // (ADR-0017). Without this entry next/image refuses to render them.
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        // The carrier's own logo, set by the register_shiprocket_provider data
        // migration. Not ours to host or to optimize — rendered unoptimized for the
        // same reason as the YouTube posters above.
        protocol: "https",
        hostname: "shiprocket.in",
      },
      {
        // Google OAuth profile pictures.
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
