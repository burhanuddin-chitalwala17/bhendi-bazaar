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

/**
 * Which form factor the words are laid out for. `responsive` is the live banner, switching at `md:`;
 * `phone` and `desktop` pin one layout so an editor's preview can show both side by side.
 */
export type HeroFrame = "responsive" | "phone" | "desktop";

/** Under the words: from the bottom on a phone, from the left where they sit on a desktop. */
const SCRIM: Record<HeroFrame, string> = {
  responsive: "bg-gradient-to-t from-scrim/85 via-scrim/40 to-transparent md:bg-gradient-to-r md:via-scrim/50 md:to-scrim/10",
  phone: "bg-gradient-to-t from-scrim/85 via-scrim/40 to-transparent",
  desktop: "bg-gradient-to-r from-scrim/85 via-scrim/50 to-scrim/10",
};

const WORDS: Record<HeroFrame, { stack: string; title: string; description: string; actions: string }> = {
  responsive: {
    stack: "max-w-xl space-y-2 md:space-y-3",
    title: "line-clamp-3 font-heading text-headline font-semibold md:text-display",
    description: "line-clamp-2 text-small text-hero-foreground/85 md:line-clamp-3 md:text-body",
    actions: "pt-2",
  },
  phone: {
    stack: "max-w-xl space-y-1",
    title: "line-clamp-3 font-heading text-title font-semibold",
    description: "line-clamp-2 text-caption text-hero-foreground/85",
    actions: "pt-1",
  },
  desktop: {
    stack: "max-w-xs space-y-1",
    title: "line-clamp-2 font-heading text-title font-semibold",
    description: "line-clamp-2 text-caption text-hero-foreground/85",
    actions: "pt-1",
  },
};

export const hasHeroWords = ({ eyebrow, title, description, actions }: Omit<HeroBannerContent, "id" | "image">) =>
  Boolean(eyebrow || title || description || (actions && actions.length > 0));

export function HeroBannerScrim({ frame = "responsive", className }: { frame?: HeroFrame; className?: string }) {
  return <div className={cn("pointer-events-none absolute inset-0 -z-10", SCRIM[frame], className)} />;
}

/**
 * A banner's words, one source for the live banner and the editor's preview so the two cannot
 * drift. In a preview the action is drawn, not followed: tapping it would leave the unsaved form.
 */
export function HeroBannerWords({
  banner,
  frame = "responsive",
  preview = false,
}: {
  banner: Omit<HeroBannerContent, "id" | "image">;
  frame?: HeroFrame;
  preview?: boolean;
}) {
  const { eyebrow, title, description, actions } = banner;
  const w = WORDS[frame];
  const compact = frame !== "responsive";
  return (
    <div className={cn("relative", w.stack)}>
      {eyebrow && <p className="text-label uppercase text-hero-foreground/80">{eyebrow}</p>}
      {title && <h2 className={w.title}>{title}</h2>}
      {description && <p className={w.description}>{description}</p>}
      {actions && actions.length > 0 && (
        <div className={cn("flex flex-wrap gap-3", w.actions)}>
          {actions.map((action) => (
            <Button
              key={action.href}
              asChild
              size={compact ? "sm" : "lg"}
              variant={action.variant === "secondary" ? "inverse" : "secondary"}
              className={cn("rounded-full", !compact && "min-h-10")}
            >
              {preview ? (
                <span aria-hidden>{action.label}</span>
              ) : (
                <Link href={action.href} prefetch={false}>
                  {action.label}
                </Link>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One hero banner: a photograph (or the plain brand surface), its words, and up to two actions, all passed in. */
/**
 * Where the banner sits. `card`: a rounded panel inside the page (a shop's storefront). `bleed`: edge
 * to edge under the header, at the desktop picture's own 5:2 so nothing of it is cropped (home).
 */
export type HeroEdge = "card" | "bleed";
const EDGE: Record<HeroEdge, { shape: string; picture: string }> = {
  card: { shape: "rounded-card", picture: "md:aspect-auto md:h-80 lg:h-96" },
  bleed: { shape: "rounded-none", picture: "md:aspect-banner-source md:max-h-svh" },
};

export function HeroBanner({
  banner,
  priority = false,
  edge = "card",
  className,
}: {
  banner: HeroBannerContent;
  /** Set on the first slide only: it is the page's LCP candidate. */
  priority?: boolean;
  edge?: HeroEdge;
  className?: string;
}) {
  const { image } = banner;
  // Artwork with nothing to read gets no scrim and no empty column.
  const hasWords = hasHeroWords(banner);

  return (
    <div
      className={cn(
        "relative isolate flex items-end overflow-hidden px-5 py-6 text-hero-foreground md:items-center md:px-10 md:py-10",
        EDGE[edge].shape,
        edge === "bleed" && "lg:px-16",
        // A picture gets the phone shape it was framed for (image-slots D9); without one, the plain brand surface.
        image ? cn("aspect-banner-phone max-h-svh", EDGE[edge].picture) : "min-h-60 bg-hero md:min-h-80",
        className,
      )}
    >
      {image && (
        <>
          <ResponsiveImage
            image={image}
            preload={priority}
            sizes={{ phone: "100vw", desktop: edge === "bleed" ? "100vw" : "(min-width: 1024px) 90rem, 100vw" }}
            className="-z-10"
          />
          {hasWords && <HeroBannerScrim />}
        </>
      )}

      {hasWords && <HeroBannerWords banner={banner} />}
    </div>
  );
}
