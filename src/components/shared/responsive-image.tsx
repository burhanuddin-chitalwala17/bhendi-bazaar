import type { CSSProperties } from "react";
import { getImageProps } from "next/image";

import { IMAGE_FIT, type FocusPoint, type ImageFit } from "@server/catalog/image-slots";
import type { ResponsiveImageDto, ResponsiveImageSide } from "@server/catalog/image-framing";

/** Tablet up gets the desktop picture (ADR-0050): the tablet breakpoint, named by hand per form-factors. */
const DESKTOP_MEDIA = "(min-width: 768px)";

/** Whole class names, so Tailwind finds them; one map per form factor. */
const PHONE_FIT: Record<ImageFit, string> = {
  [IMAGE_FIT.CROP]: "object-cover",
  [IMAGE_FIT.CONTAIN]: "object-contain",
};
const DESKTOP_FIT: Record<ImageFit, string> = {
  [IMAGE_FIT.CROP]: "md:object-cover",
  [IMAGE_FIT.CONTAIN]: "md:object-contain",
};

const percent = (point: FocusPoint) => `${Math.round(point.x * 1000) / 10}% ${Math.round(point.y * 1000) / 10}%`;
const fillOf = (side: ResponsiveImageSide) => (side.fit === IMAGE_FIT.CONTAIN && side.fill ? side.fill : "transparent");

/**
 * Every slot picture, phone and desktop (image-slots trd D6): two optimizer `srcset`s in one
 * `<picture>`, so a phone downloads only the phone file. One `<img>` serves both sources, so the
 * framing that differs by form factor travels as custom properties the `md:` classes switch between.
 * Fills its positioned parent; the box's shape is the caller's.
 */
export function ResponsiveImage({
  image,
  sizes,
  preload = false,
  className,
}: {
  image: ResponsiveImageDto;
  /** The real slot width per form factor (ADR-0026), never `100vw` on something smaller. */
  sizes: { phone: string; desktop: string };
  /** The page's LCP candidate. Eager and high priority rather than a `<link rel=preload>`, which names
   *  one file and would fetch the wrong one for half the visitors. */
  preload?: boolean;
  className?: string;
}) {
  const eager = preload ? ({ loading: "eager", fetchPriority: "high" } as const) : {};
  const { props: desktop } = getImageProps({ alt: image.alt, fill: true, src: image.desktop.src, sizes: sizes.desktop, ...eager });
  const { props: phone } = getImageProps({ alt: image.alt, fill: true, src: image.phone.src, sizes: sizes.phone, ...eager });

  const framing = {
    "--slot-pos-phone": percent(image.phone.position),
    "--slot-pos-desktop": percent(image.desktop.position),
    "--slot-fill-phone": fillOf(image.phone),
    "--slot-fill-desktop": fillOf(image.desktop),
  } as CSSProperties;

  const classes = [
    PHONE_FIT[image.phone.fit],
    DESKTOP_FIT[image.desktop.fit],
    "object-(--slot-pos-phone) bg-(--slot-fill-phone) md:object-(--slot-pos-desktop) md:bg-(--slot-fill-desktop)",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <picture>
      <source media={DESKTOP_MEDIA} srcSet={desktop.srcSet} sizes={desktop.sizes} />
      {/* The optimizer's own srcset and sizes, via getImageProps (ADR-0026). */}
      <img {...phone} alt={image.alt} style={{ ...phone.style, ...framing }} className={classes} />
    </picture>
  );
}
