import Image from "next/image";

import { cn } from "@/lib/utils";
import { IMAGE_FIT } from "@server/catalog/image-slots";
import type { ResponsiveImageSide } from "@server/catalog/image-framing";

/**
 * One form factor of a slot as it will render (spec R5): the slot's own shape, the picture cropped
 * or fitted the way the saved row will draw it. A preview sits at a known small width, so `sizes`
 * says so rather than claiming the screen.
 */
export function SlotPreview({
  side,
  aspect,
  sizes,
  className,
  children,
}: {
  side: ResponsiveImageSide | null;
  /** Width over height of the box. */
  aspect: number;
  sizes: string;
  className?: string;
  /** Drawn over the picture: what the slot lays on it (a banner's words). */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-field border border-border bg-muted", className)}
      style={{ aspectRatio: `${aspect}` }}
    >
      {side ? (
        <Image
          src={side.src}
          alt=""
          fill
          sizes={sizes}
          className={side.fit === IMAGE_FIT.CONTAIN ? "object-contain" : "object-cover"}
          style={{
            objectPosition: `${side.position.x * 100}% ${side.position.y * 100}%`,
            backgroundColor: side.fit === IMAGE_FIT.CONTAIN && side.fill ? side.fill : undefined,
          }}
        />
      ) : null}
      {children}
    </div>
  );
}
