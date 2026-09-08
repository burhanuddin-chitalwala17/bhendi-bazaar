import type { NextConfig } from "next";
// Relative import: next.config loads before tsconfig path aliases exist.
import { crawlersBlocked } from "./src/lib/crawl-block";

const nextConfig: NextConfig = {
  async headers() {
    // Pre-launch crawl block (src/lib/crawl-block.ts): noindex for bots that
    // skip robots.txt but honour the header. Read once per build, which is when
    // the deployment's env is fixed anyway.
    if (!crawlersBlocked()) return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "o42adyjkazl35sk2.public.blob.vercel-storage.com",
      },
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
    ],
  },
};

export default nextConfig;
