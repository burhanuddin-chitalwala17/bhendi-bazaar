import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ResponsiveImage } from "@/components/shared/responsive-image";
import type { ResponsiveImageDto } from "@server/catalog/image-framing";
import { cn } from "@/lib/utils";

export type HeroAction = {
  label: string;
  href: string;
  /** `secondary` is the outlined treatment; omit for the filled primary. */
  variant?: "primary" | "secondary";
};

export type HeroBannerContent = {
  id: string;
  eyebrow?: string;
  /** Optional: artwork that carries its own typography needs no headline over it. */
  title?: string;
  description?: string;
  /** Optional. Without one the banner falls back to the brand gradient scene. */
  image?: ResponsiveImageDto;
  actions?: HeroAction[];
};

/** One hero banner: a photograph (or the plain brand surface), its words, and up to two actions, all passed in. */
export function HeroBanner({
  banner,
  priority = false,
  className,
}: {
  banner: HeroBannerContent;
  /** Set on the first slide only: it is the page's LCP candidate. */
  priority?: boolean;
  className?: string;
}) {
  const { eyebrow, title, description, image, actions } = banner;
  // Artwork with nothing to read gets no scrim and no empty column.
  const hasWords = Boolean(eyebrow || title || description || (actions && actions.length > 0));

  return (
    <div
      className={cn(
        "relative isolate flex items-end overflow-hidden rounded-card px-5 py-6 text-hero-foreground md:items-center md:px-10 md:py-10",
        // A picture gets the phone shape it was framed for (image-slots D9); without one, the plain brand surface.
        image ? "aspect-banner-phone max-h-svh md:aspect-auto md:h-80 lg:h-96" : "min-h-60 bg-hero md:min-h-80",
        className,
      )}
    >
      {image && (
        <>
          <ResponsiveImage
            image={image}
            preload={priority}
            sizes={{ phone: "100vw", desktop: "(min-width: 1024px) 72rem, 100vw" }}
            className="-z-10"
          />
          {/* Under the words: from the bottom on a phone, from the left where they sit on a desktop. */}
          {hasWords && (
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-scrim/85 via-scrim/40 to-transparent md:bg-gradient-to-r md:via-scrim/50 md:to-scrim/10" />
          )}
        </>
      )}

      {hasWords && (
        <div className="relative max-w-xl space-y-2 md:space-y-3">
          {eyebrow && <p className="text-label uppercase text-hero-foreground/80">{eyebrow}</p>}
          {title && <h2 className="line-clamp-3 font-heading text-headline font-semibold md:text-display">{title}</h2>}
          {description && <p className="line-clamp-2 text-small text-hero-foreground/85 md:line-clamp-3 md:text-body">{description}</p>}
          {actions && actions.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-2">
              {actions.map((action) => (
                <Button
                  key={action.href}
                  asChild
                  size="lg"
                  variant={action.variant === "secondary" ? "inverse" : "secondary"}
                  className="min-h-10 rounded-full"
                >
                  <Link href={action.href} prefetch={false}>
                    {action.label}
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
