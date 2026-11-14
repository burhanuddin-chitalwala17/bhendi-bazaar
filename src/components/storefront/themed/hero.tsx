import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CardStyle, SectionVariant } from "@server/catalog/storefront-themes";
import type { HeroSlice, HeroSlide } from "./page-data";
import { shopAllLabel, shopHref } from "./section-heading";
import { ThemePhoto } from "./theme-photo";
import { ASPECT, ThemedProductCard } from "./themed-product-card";
import { THEMED_COPY } from "./themed-copy";

type HeroVariant = SectionVariant<"hero">;

/** Hero photos are the storefront-hero slot: tall 4:5 on a phone, wide 16:9 from md (storefront-look Q12). */
const HERO_ASPECT = "aspect-[4/5] md:aspect-video";
/** Banners are the org-banner slot: tall 4:5 on a phone, wide 5:2 from md (storefront-look Q12). */
const BANNER_ASPECT = "aspect-[4/5] md:aspect-[5/2]";
/** With no photo the pattern is a band on a phone, so it never fills the first screen (storefront-look R4, R9). */
const PATTERN_ASPECT = "aspect-[2/1] md:aspect-video";

/**
 * The landing page's first screen in four variants (storefront-look Q3, Q4, D3). Text never sits on
 * a photo: the shop's identity is beside or below it, and the space beside the photo holds goods, so
 * the first phone screen and the desktop hero are never bare (R4, R5). With no photo each draws the
 * theme's pattern (storefront-themes Q17).
 */
export function ThemedHero({
  variant,
  cardStyle,
  ...hero
}: HeroSlice & { variant: HeroVariant; cardStyle: CardStyle }) {
  if (variant === "ribbon") return <RibbonHero hero={hero} cardStyle={cardStyle} />;
  if (variant === "banner") return <BannerHero hero={hero} />;
  if (variant === "split") return <SplitHero hero={hero} cardStyle={cardStyle} />;
  return <FullBleedHero hero={hero} cardStyle={cardStyle} />;
}

/** Edge: the photo edge to edge on a phone, identity on solid ground below; desktop puts two goods beside. */
function FullBleedHero({ hero, cardStyle }: { hero: HeroSlice; cardStyle: CardStyle }) {
  return (
    <section className="md:mx-auto md:grid md:max-w-store md:grid-cols-3 md:gap-grid md:px-gutter md:pt-6">
      <HeroPhoto hero={hero} className="md:col-span-2" sizes="(min-width: 768px) 66vw, 100vw" />
      <div className="space-y-4 bg-card px-gutter py-4 md:rounded-card md:p-6">
        <Identity hero={hero} phoneButton />
        <Featured
          hero={hero}
          count={2}
          cardStyle={cardStyle}
          sizes="(min-width: 1024px) 14vw, 16vw"
          className="hidden gap-3 md:grid md:grid-cols-2"
        />
      </div>
    </section>
  );
}

/** Darbar: the photo, a solid name card overlapping its foot, the ribbon line, and on desktop four goods. */
function RibbonHero({ hero, cardStyle }: { hero: HeroSlice; cardStyle: CardStyle }) {
  return (
    <section>
      <HeroPhoto hero={hero} className="md:mx-auto md:max-w-4xl" sizes="(min-width: 768px) 896px, 100vw" />
      <div className="relative mx-auto -mt-10 max-w-xl px-gutter md:-mt-14">
        <div className="space-y-3 border border-border bg-card px-4 py-4 text-center md:px-6 md:py-6">
          <Identity hero={hero} centred />
        </div>
      </div>
      {hero.line && (
        <p className="mt-6 bg-feature px-gutter py-2 text-center font-label text-tag tracking-tag text-feature-foreground">
          {hero.line}
        </p>
      )}
      <div className="mx-auto hidden max-w-store px-gutter pt-6 md:block">
        <Featured
          hero={hero}
          count={4}
          cardStyle={cardStyle}
          sizes="(min-width: 1024px) 22vw, 25vw"
          className="grid grid-cols-4 gap-grid"
        />
      </div>
    </section>
  );
}

/** Bloom: phone stacks photo then identity; desktop sets identity and a row of four best selling beside the photo. */
function SplitHero({ hero, cardStyle }: { hero: HeroSlice; cardStyle: CardStyle }) {
  return (
    <section className="md:mx-auto md:grid md:max-w-store md:grid-cols-2 md:items-start md:gap-8 md:px-gutter md:pt-6">
      <HeroPhoto hero={hero} sizes="(min-width: 768px) 50vw, 100vw" />
      <div className="space-y-5 px-gutter pt-4 md:px-0 md:pt-0">
        <Identity hero={hero} />
        {hero.featured.length > 0 && (
          <div className="hidden space-y-3 md:block">
            <p className="font-label text-tag uppercase tracking-tag text-muted-foreground">{THEMED_COPY.hero.bestSelling}</p>
            <Featured
              hero={hero}
              count={4}
              cardStyle={cardStyle}
              sizes="(min-width: 1024px) 11vw, 12vw"
              className="grid grid-cols-4 gap-3"
            />
          </div>
        )}
      </div>
    </section>
  );
}

/** Daily: the shop's banners then photos — one main slide, two beside it on desktop — derived facts, identity. */
function BannerHero({ hero }: { hero: HeroSlice }) {
  const slides = hero.slides;
  const side = slides.length > 1;
  return (
    <section className="mx-auto max-w-store space-y-3 pt-3">
      {slides.length === 0 ? (
        <div className="px-gutter">
          <HeroPhoto hero={hero} sizes="100vw" />
        </div>
      ) : (
        <ul
          className={cn(
            "no-scrollbar flex snap-x gap-grid overflow-x-auto px-gutter md:grid md:overflow-visible",
            slides.length === 2 && "md:grid-cols-2",
            slides.length === 3 && "md:grid-cols-3",
          )}
        >
          {slides.map((slide, index) => (
            <li
              key={slide.key}
              className={cn(
                "shrink-0 snap-start md:w-auto",
                side ? "w-[84%]" : "w-full",
                // Three: a main slide and two stacked beside it. Two: equal halves, so no cell is blank (storefront-look R9).
                slides.length === 3 && index === 0 && "md:col-span-2 md:row-span-2",
              )}
            >
              <Slide
                slide={slide}
                alt={hero.name}
                priority={index === 0}
                sizes={!side ? "100vw" : slides.length === 2 ? "(min-width: 768px) 50vw, 84vw" : index === 0 ? "(min-width: 768px) 66vw, 84vw" : "(min-width: 768px) 33vw, 84vw"}
              />
            </li>
          ))}
        </ul>
      )}
      {hero.trust.length > 0 && (
        <ul className="no-scrollbar flex gap-2 overflow-x-auto px-gutter">
          {hero.trust.map((fact) => (
            <li key={fact} className="shrink-0 rounded-field bg-muted px-3 py-1 text-caption text-foreground">
              {fact}
            </li>
          ))}
        </ul>
      )}
      <div className="px-gutter pt-1">
        <Identity hero={hero} />
      </div>
    </section>
  );
}

/** A banner keeps its own shape and colours; its words sit on a solid label at its foot (storefront-look Q3). */
function Slide({ slide, alt, priority, sizes }: { slide: HeroSlide; alt: string; priority: boolean; sizes: string }) {
  const picture = (
    <div data-hero-photo className="relative overflow-hidden rounded-card">
      <ThemePhoto
        src={slide.src}
        image={slide.image}
        alt={slide.image?.alt || alt}
        initial={alt}
        priority={priority}
        sizes={sizes}
        className={slide.key.startsWith("banner-") ? BANNER_ASPECT : HERO_ASPECT}
      />
      {slide.title && <SolidLabel title={slide.title} action={slide.href ? slide.actionLabel : null} />}
    </div>
  );
  return slide.href ? (
    <Link href={slide.href} prefetch={false} className="block">
      {picture}
    </Link>
  ) : (
    picture
  );
}

function SolidLabel({ title, action }: { title: string; action: string | null }) {
  return (
    <p className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-field bg-card px-3 py-2 text-card-foreground shadow-raised">
      <span className="truncate text-small font-semibold">{title}</span>
      {action && <span className="shrink-0 text-small underline underline-offset-2">{action}</span>}
    </p>
  );
}

/** The hero's picture: the shop's first banner with its label when it has one, else its first hero photo. */
function HeroPhoto({ hero, className, sizes }: { hero: HeroSlice; className?: string; sizes: string }) {
  const banner = hero.slides.find((slide) => slide.key.startsWith("banner-") && slide.title);
  const pictured = Boolean(hero.photoUrl || hero.image);
  return (
    <div data-hero-photo className={cn("relative overflow-hidden md:rounded-card", className)}>
      <ThemePhoto
        src={hero.photoUrl}
        image={hero.image}
        alt={hero.name}
        initial={hero.name}
        priority
        sizes={sizes}
        className={cn("w-full", pictured ? HERO_ASPECT : PATTERN_ASPECT)}
      />
      {pictured && banner?.title && <SolidLabel title={banner.title} action={banner.href ? banner.actionLabel : null} />}
    </div>
  );
}

/** Who the shop is, in the same order in every theme: logo and name, line, facts, the way in. */
function Identity({ hero, centred = false, phoneButton = false }: { hero: HeroSlice; centred?: boolean; phoneButton?: boolean }) {
  const chips = [
    hero.rating && THEMED_COPY.hero.rating(hero.rating.average, formatCount(hero.rating.count)),
    THEMED_COPY.hero.since(hero.since),
    THEMED_COPY.hero.products(hero.productCount, formatCount(hero.productCount)),
  ].filter((chip): chip is string => Boolean(chip));

  return (
    <div className={cn("space-y-3", centred && "text-center")}>
      <div className={cn("flex items-center gap-3", centred && "flex-col gap-2")}>
        {hero.logoUrl && (
          <Image
            src={hero.logoUrl}
            alt={`${hero.name} logo`}
            width={48}
            height={48}
            sizes="48px"
            className="size-12 shrink-0 rounded-full bg-muted object-cover"
          />
        )}
        <div className="min-w-0">
          <h1 className="break-words font-display text-headline font-display-weight display-case tracking-headline">
            {hero.name}
          </h1>
          {hero.line && !centred && <p className="break-words text-small text-muted-foreground">{hero.line}</p>}
        </div>
      </div>
      <ul className={cn("flex flex-wrap gap-1.5", centred && "justify-center")}>
        {chips.map((chip) => (
          <li key={chip} className="rounded-field bg-muted px-2.5 py-0.5 text-caption text-foreground">
            {chip}
          </li>
        ))}
      </ul>
      {hero.productCount > 0 && (
        // On a phone only Edge shows it: the others reach categories within the first screen (storefront-look Q13).
        <Button asChild className={cn("min-h-11 px-6", !phoneButton && "hidden md:inline-flex")}>
          <Link href={shopHref(hero.handle)} prefetch={false}>
            {shopAllLabel(hero.productCount)}
          </Link>
        </Button>
      )}
    </div>
  );
}

/** Goods beside the photo; a slot with nothing to fill draws the theme's pattern (storefront-look R9). */
function Featured({
  hero,
  count,
  cardStyle,
  sizes,
  className,
}: {
  hero: HeroSlice;
  count: number;
  cardStyle: CardStyle;
  sizes: string;
  className: string;
}) {
  if (hero.featured.length === 0) return null;
  const slots = Array.from({ length: count }, (_, i) => hero.featured[i] ?? null);
  return (
    <div className={className}>
      {slots.map((product, index) =>
        product ? (
          <ThemedProductCard key={product.id} product={product} shopHandle={hero.handle} cardStyle={cardStyle} sizes={sizes} />
        ) : (
          <ThemePhoto key={`empty-${index}`} src={null} alt="" sizes={sizes} className={cn(ASPECT[cardStyle], "rounded-card")} />
        ),
      )}
    </div>
  );
}
