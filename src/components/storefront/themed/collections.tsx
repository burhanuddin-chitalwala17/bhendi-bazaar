import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SectionVariant } from "@server/catalog/storefront-themes";
import type { CollectionsSlice } from "./page-data";
import { SectionHeading, shopHref } from "./section-heading";
import { ThemePhoto } from "./theme-photo";
import { THEMED_COPY } from "./themed-copy";

/** The shop's categories as a rail, an arched rail, or circles (Q8, Q10). */
export function ThemedCollections({
  variant,
  handle,
  tiles,
}: CollectionsSlice & { variant: SectionVariant<"collections"> }) {
  const href = (slug: string) => `${shopHref(handle)}?category=${encodeURIComponent(slug)}`;

  // Darbar: arched tiles in a rail, the same size as Edge's, several to a screen (storefront-look Q5).
  if (variant === "editorial") {
    return (
      <section className="mx-auto max-w-store space-y-4 py-section">
        <div className="px-gutter">
          <SectionHeading title={THEMED_COPY.sections.shopByCategory} />
        </div>
        <ul className="no-scrollbar flex snap-x gap-grid overflow-x-auto px-gutter">
          {tiles.map((tile) => (
            <li key={tile.slug} className="w-28 shrink-0 snap-start md:w-44">
              <Link href={href(tile.slug)} prefetch={false} className="block space-y-2 text-center">
                <ThemePhoto
                  src={tile.photoUrl}
                  image={tile.image}
                  alt={tile.name}
                  initial={tile.name}
                  sizes="(min-width: 768px) 176px, 112px"
                  className="aspect-[3/4] rounded-t-full border border-border"
                />
                <span className="line-clamp-2 block break-words font-display text-caption font-display-weight display-case tracking-tag">
                  {tile.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const circles = variant === "circles";
  return (
    <section className="mx-auto max-w-store space-y-4 px-gutter py-section">
      <SectionHeading title={THEMED_COPY.sections.shopByCategory} />
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
