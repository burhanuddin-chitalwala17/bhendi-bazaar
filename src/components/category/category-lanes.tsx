import Image from "next/image";
import Link from "next/link";

import type { Category } from "@/domain/category";
import { cn } from "@/lib/utils";

/**
 * One scrollable line of category tiles below the current page: descend-only on the marketplace,
 * or a shop's filter rail when `hrefFor` and `activeSlug` are passed. A server component.
 */
export function CategoryLanes({
  categories,
  hrefFor = (category) => `/category/${category.slug}`,
  activeSlug,
}: {
  categories: Category[];
  /** Where a tile points. Defaults to the marketplace's category page. */
  hrefFor?: (category: Category) => string;
  /** Drawn as selected. Only a filtering rail has one. */
  activeSlug?: string;
}) {
  if (categories.length === 0) return null;

  return (
    // Bleeds past the gutter so the row reads as scrollable, not truncated.
    <nav
      aria-label="Categories"
      className="relative -mx-3 sm:-mx-6 lg:-mx-8"
    >
      <ul className="no-scrollbar flex gap-3 overflow-x-auto px-3 sm:gap-4 sm:px-6 lg:px-8">
        {categories.map((category) => (
          <li key={category.slug} className="shrink-0">
            <Link
              prefetch={false}
              href={hrefFor(category)}
              aria-current={activeSlug === category.slug ? "page" : undefined}
              className="flex w-18 flex-col items-center gap-1.5 md:w-20"
            >
              <span
                className={cn(
                  "relative size-16 overflow-hidden rounded-full border border-border bg-muted",
                  activeSlug === category.slug &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                <Image
                  src={category.heroImage}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </span>
              <span
                className={cn(
                  "line-clamp-2 text-center text-caption font-medium",
                  activeSlug === category.slug
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
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
