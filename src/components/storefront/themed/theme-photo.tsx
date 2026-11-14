import Image from "next/image";

import { cn } from "@/lib/utils";
import { ResponsiveImage } from "@/components/shared/responsive-image";
import type { ResponsiveImageDto } from "@server/catalog/image-framing";

/**
 * A photo slot that is never an empty box (R10, Q17): the image through the optimizer at the
 * size its slot declares (R11, ADR-0026), or the theme's drawn pattern with the shop's initial
 * where a mark belongs. The box's shape is the caller's, so a variant declares its own aspect.
 */
export function ThemePhoto({
  src,
  image,
  alt,
  sizes,
  initial,
  priority,
  className,
}: {
  src: string | null;
  /** The phone and desktop framing the shop chose (image-slots D10); wins over `src` when present. */
  image?: ResponsiveImageDto | null;
  alt: string;
  sizes: string;
  /** Drawn on the pattern when there is no photo; omit where no mark belongs. */
  initial?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {image ? (
        <ResponsiveImage image={image} sizes={{ phone: sizes, desktop: sizes }} preload={priority} />
      ) : src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div
          data-testid="theme-pattern"
          role="presentation"
          className="bg-theme-pattern absolute inset-0 flex items-center justify-center"
        >
          {initial && (
            <span aria-hidden className="font-display text-headline font-display-weight text-muted-foreground">
              {initial.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
