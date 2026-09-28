"use client";

import Image from "next/image";
import { Youtube } from "lucide-react";
import { youtubePosterUrl } from "@server/catalog/media";

interface YouTubePosterProps {
  ref_: string;
  sizes: string;
  alt?: string;
}

/**
 * A video's still, for tiles that only need to show it exists — the library, the picker.
 * `unoptimized` on purpose: i.ytimg.com serves its own already-sized poster frames, so
 * optimizing spends a transformation to save nothing, and none of it is our egress (ADR-0026).
 */
export function YouTubePoster({ ref_, sizes, alt = "" }: YouTubePosterProps) {
  return (
    <>
      <Image src={youtubePosterUrl(ref_)} alt={alt} fill sizes={sizes} className="object-cover" unoptimized />
      <span className="absolute inset-0 flex items-center justify-center bg-scrim/40">
        <Youtube className="size-6 text-hero-foreground" aria-hidden />
      </span>
    </>
  );
}
