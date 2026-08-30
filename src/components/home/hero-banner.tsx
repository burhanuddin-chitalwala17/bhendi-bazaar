import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
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
  title: string;
  description?: string;
  /** Optional. Without one the banner falls back to the brand gradient scene. */
  image?: { src: string; alt: string };
  actions?: HeroAction[];
};

/**
 * One hero banner: background, words, and up to a couple of calls to action, all
 * passed in. Nothing about a specific campaign lives here — the copy and the
 * destinations come from `src/lib/home-banners.ts`, so a new banner is a config
 * entry rather than a component.
 */
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

  return (
    // A phone shows one screenful at a time; a full-height brand hero spends it on
    // something nobody came to buy. Compact banner on mobile, the full scene from sm.
    <div
      className={cn(
        "group relative isolate flex h-60 items-center overflow-hidden rounded-xl border border-border/70 px-4 py-6 text-hero-foreground sm:h-80 sm:rounded-2xl sm:px-10 sm:py-10 lg:h-96",
        !image && "bg-gradient-to-br from-hero via-hero/90 to-scrim",
        className
      )}
    >
      {image ? (
        <>
          <Image
            src={image.src}
            alt={image.alt}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 72rem, 100vw"
            className="-z-10 object-cover"
          />
          {/* Reading happens on the left, so the scrim is heaviest there rather than
              flat across — a flat dim costs the photograph more than it needs to. */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-scrim/85 via-scrim/55 to-scrim/20",
              "transition-opacity duration-300 motion-reduce:transition-none md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            )}
          />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute -left-10 -top-20 -z-10 size-64 rounded-full border border-primary/15" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-tr from-scrim/40 via-transparent to-hero-foreground/10" />
        </>
      )}

      <div
        className={cn(
          "relative max-w-xl space-y-2 sm:space-y-4",
          image && "transition-opacity duration-300 motion-reduce:transition-none md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        )}
      >
        {eyebrow && (
          <p className="text-4xs font-semibold uppercase tracking-eyebrow-wide text-hero-foreground/70 sm:text-2xs sm:tracking-display">
            {eyebrow}
          </p>
        )}
        <h2 className="line-clamp-2 font-heading text-xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h2>
        {description && (
          <p className="line-clamp-2 text-xs leading-snug text-hero-foreground/80 sm:line-clamp-3 sm:text-base sm:leading-normal">
            {description}
          </p>
        )}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2">
            {actions.map((action) => (
              <Button
                key={action.href}
                asChild
                variant={action.variant === "secondary" ? "outline" : "default"}
                className={cn(
                  "rounded-full px-6 text-xs font-semibold uppercase tracking-eyebrow",
                  action.variant === "secondary"
                    ? "border-primary/20 bg-transparent text-hero-foreground hover:bg-hero/40"
                    : "bg-primary text-hero hover:bg-primary/80"
                )}
              >
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
