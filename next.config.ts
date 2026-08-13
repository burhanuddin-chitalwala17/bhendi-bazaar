import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
