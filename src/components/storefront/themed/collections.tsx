import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SectionVariant } from "@server/catalog/storefront-themes";
import type { CollectionsSlice } from "./page-data";
import { SectionHeading, shopHref } from "./section-heading";
import { ThemePhoto } from "./theme-photo";

/** Darbar's editorial run is three tall tiles (spec Theme cards). */
const EDITORIAL_COUNT = 3;

/** The shop's categories as a rail, an editorial run, or circles (Q8, Q10). */
export function ThemedCollections({
  variant,
  handle,
  tiles,
}: CollectionsSlice & { variant: SectionVariant<"collections"> }) {
  const href = (slug: string) => `${shopHref(handle)}?category=${encodeURIComponent(slug)}`;

  if (variant === "editorial") {
    return (
      <section className="mx-auto max-w-store space-y-6 py-section">
        {tiles.slice(0, EDITORIAL_COUNT).map((tile) => (
          <Link key={tile.slug} href={href(tile.slug)} prefetch={false} className="block text-center">
            <ThemePhoto
              src={tile.photoUrl}
              image={tile.image}
              alt={tile.name}
              initial={tile.name}
              sizes="(min-width: 1024px) 1200px, 100vw"
              className="aspect-[4/5] w-full md:aspect-[21/9]"
            />
            <span className="mt-3 block font-display text-title uppercase tracking-headline">{tile.name}</span>
            <span className="font-label text-tag uppercase tracking-tag underline underline-offset-4">Explore</span>
          </Link>
        ))}
      </section>
    );
  }

  const circles = variant === "circles";
  return (
    <section className="mx-auto max-w-store space-y-4 px-gutter py-section">
      <SectionHeading title="Shop by category" />
      <ul
        className={cn(
          circles
            ? "grid grid-cols-4 gap-grid md:grid-cols-6"
            : "no-scrollbar -mx-gutter flex snap-x gap-grid overflow-x-auto px-gutter",
        )}
      >
        {tiles.map((tile) => (
          <li key={tile.slug} className={cn(!circles && "w-40 shrink-0 snap-start md:w-56")}>
            <Link href={href(tile.slug)} prefetch={false} className="block space-y-2 text-center">
              <ThemePhoto
                src={tile.photoUrl}
                image={tile.image}
                alt={tile.name}
                initial={tile.name}
                sizes={circles ? "(min-width: 768px) 120px, 25vw" : "(min-width: 768px) 224px, 160px"}
                className={circles ? "aspect-square rounded-full" : "aspect-[4/5] rounded-card"}
              />
              <span className="line-clamp-2 block break-words text-body">{tile.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
