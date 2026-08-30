import Image from "next/image";
import Link from "next/link";

import type { Category } from "@/domain/category";
import { CATEGORY_ACCENTS } from "@/lib/category-accent";
import { cn } from "@/lib/utils";

/**
 * The storefront's category navigation: one flat, scrollable line of tiles for
 * every lane beneath the current page. Descend-only, so the current category,
 * its ancestors and its siblings are all absent — which is why there is no
 * active state to draw and why an empty set renders nothing rather than an
 * empty rail.
 *
 * A server component: it is display over data the page already has, and a route
 * handler for it would be a round trip bought for nothing.
 */
export function CategoryLanes({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    // Bleeds past the layout gutter so tiles run to the screen edge and the row
    // reads as scrollable rather than as a truncated list.
    <nav
      aria-label="Categories"
      className="relative -mx-3 mb-4 sm:-mx-6 sm:mb-6 lg:-mx-8"
    >
      <ul className="no-scrollbar flex gap-3 overflow-x-auto px-3 sm:gap-4 sm:px-6 lg:px-8">
        {categories.map((category) => (
          <li key={category.slug} className="shrink-0">
            {/* Prefetch off for the same reason as ProductCard: the whole rail is in view,
                and a dynamic route's prefetch is discarded before the tap can use it. */}
            <Link
              prefetch={false}
              href={`/category/${category.slug}`}
              className="flex w-16 flex-col items-center gap-1.5 sm:w-20"
            >
              <span
                className={cn(
                  "relative size-14 overflow-hidden rounded-full border border-border/70 bg-gradient-to-br sm:size-16",
                  CATEGORY_ACCENTS[category.accent].heroGradient
                )}
              >
                {/* Centre crop of the 1200×600 hero — a square thumbnail column
                    is the follow-up, not a blocker. */}
                <Image
                  src={category.heroImage}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </span>
              <span className="line-clamp-2 text-center text-3xs font-medium leading-tight text-muted-foreground">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent"
      />
    </nav>
  );
}
