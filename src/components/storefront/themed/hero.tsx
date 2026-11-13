import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SectionVariant } from "@server/catalog/storefront-themes";
import type { HeroSlice } from "./page-data";
import { shopAllLabel, shopHref } from "./section-heading";
import { ThemePhoto } from "./theme-photo";

type HeroVariant = SectionVariant<"hero">;

/**
 * The landing page's first screen in four variants (Q8; spec Theme cards, "Hero"). With no
 * photo each draws the theme's pattern (Q17), so a name and a logo alone are a finished page
 * (R10, A4). Text over a photo sits on the scrim token (D4); over the pattern it is the
 * palette's own ink.
 */
export function ThemedHero({ variant, ...hero }: HeroSlice & { variant: HeroVariant }) {
  const onPhoto = Boolean(hero.photoUrl);
  const cta = hero.productCount > 0 && (
    <Button asChild className="min-h-11 px-6">
      <Link href={shopHref(hero.handle)} prefetch={false}>
        {shopAllLabel(hero.productCount)}
      </Link>
    </Button>
  );

  if (variant === "split" || variant === "banner") {
    const split = variant === "split";
    return (
      <section
        className={cn(
          "mx-auto grid max-w-store items-center gap-grid px-gutter",
          split ? "py-section md:grid-cols-2" : "grid-cols-5 py-4",
        )}
      >
        <ThemePhoto
          src={hero.photoUrl}
          image={hero.image}
          alt={hero.name}
          initial={hero.name}
          priority
          sizes={split ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 30vw, 40vw"}
          className={cn("rounded-card", split ? "aspect-square" : "col-span-2 aspect-[4/3]")}
        />
        <div className={cn("min-w-0 space-y-3", !split && "col-span-3")}>
          <Mark hero={hero} />
          <h1 className="break-words font-display text-headline font-display-weight display-case tracking-headline">{hero.name}</h1>
          {hero.line && <p className="break-words text-body text-muted-foreground">{hero.line}</p>}
          {cta}
        </div>
      </section>
    );
  }

  const ribbon = variant === "ribbon";
  return (
    <section>
      <div className="relative">
        <ThemePhoto
          src={hero.photoUrl}
          image={hero.image}
          alt={hero.name}
          priority
          sizes="100vw"
          className={cn("w-full", ribbon ? "aspect-[3/4] md:aspect-[21/9]" : "aspect-[4/5] md:aspect-[16/9]")}
        />
        <div
          className={cn(
            "absolute inset-0 flex flex-col justify-end gap-3 px-gutter py-section",
            ribbon && "items-center justify-center text-center",
            onPhoto ? "bg-photo-scrim text-on-photo" : "text-foreground",
          )}
        >
          <div className="mx-auto w-full max-w-store space-y-3">
            <Mark hero={hero} />
            <h1 className="break-words font-display text-headline font-display-weight display-case tracking-headline">
              {hero.name}
            </h1>
            {!ribbon && (
              <p className="font-label text-tag uppercase tracking-tag">
                Since {hero.since}
                {hero.productCount > 0 && ` · ${hero.productCount} ${hero.productCount === 1 ? "product" : "products"}`}
              </p>
            )}
            {!ribbon && hero.line && <p className="max-w-prose break-words text-body">{hero.line}</p>}
            {cta}
          </div>
        </div>
      </div>
      {ribbon && hero.line && (
        <p className="bg-feature px-gutter py-3 text-center font-label text-tag uppercase tracking-tag text-feature-foreground">
          {hero.line}
        </p>
      )}
    </section>
  );
}

/** The shop's logo, or nothing: the name beside it already says whose page this is. */
function Mark({ hero }: { hero: HeroSlice }) {
  if (!hero.logoUrl) return null;
  return (
    <Image
      src={hero.logoUrl}
      alt={`${hero.name} logo`}
      width={56}
      height={56}
      sizes="56px"
      className="size-14 rounded-full bg-card object-cover"
    />
  );
}
