"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ImageLightbox as Lightbox } from "@/components/shared/image-lightbox";

const ImageLightbox = dynamic(() => import("@/components/shared/image-lightbox").then((m) => m.ImageLightbox), {
  ssr: false,
});

/** The lightbox, mounted (and its code fetched) only while it is open, so a page never pays for it unopened (B12). */
export function LazyImageLightbox(props: ComponentProps<typeof Lightbox>) {
  return props.open ? <ImageLightbox {...props} /> : null;
}
