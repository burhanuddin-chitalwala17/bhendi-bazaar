"use client";

import type { ImageLoaderProps } from "next/image";
import { deliveryWidthFor, hasWidthCopies, widthPathFor } from "@server/catalog/image-widths";

/**
 * Every next/image goes through here instead of Vercel's optimizer (ADR-0075). Our photographs are
 * already stored at each DELIVERY_WIDTH, so the browser is pointed at the nearest copy in the
 * bucket; anything else is served as it is.
 */
export default function imageLoader({ src, width }: ImageLoaderProps): string {
  // Inlined at build by next.config.ts from R2_PUBLIC_BASE_URL, so the browser knows our host.
  const base = process.env.IMAGE_STORE_BASE_URL;
  if (!base || !src.startsWith(`${base}/`)) return src;
  const pathname = src.slice(base.length + 1);
  if (!hasWidthCopies(pathname)) return src;
  const copy = deliveryWidthFor(width);
  return copy ? `${base}/${widthPathFor(pathname, copy)}` : src;
}
