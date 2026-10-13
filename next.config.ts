import type { NextConfig } from "next";
// Relative import: next.config loads before tsconfig path aliases exist.
import { crawlersBlocked } from "./src/lib/crawl-block";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
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

    return [{ source: "/:path*", headers }];
  },
  images: {
    // A year, matching the `immutable, max-age=31536000` that object-store.ts writes.
    // buildImagePath timestamps every stored path, so a URL's bytes never change and
    // there is nothing a shorter TTL could protect against — while a shorter one costs
    // real money: a transformation is billed per cache MISS, and Hobby includes only
    // 5,000 a month. At 30 days the whole catalogue re-transformed monthly for nothing.
    minimumCacheTTL: 31536000,
    remotePatterns: [
      // The object store, read from the environment rather than pinned here: the bucket
      // is r2.dev while developing and a custom domain in production (ADR-0028), and a
      // host missing from this list makes every image 404 at the optimizer with no
      // error anywhere.
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
