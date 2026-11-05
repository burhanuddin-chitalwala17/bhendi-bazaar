import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { ScrollRail } from "@/components/shared/scroll-rail";
import type { Category } from "@/domain/category";
import { CATEGORY_COPY } from "./category-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * Home's top-level categories as arch-topped pictures, one line at every size, never wrapping (owner,
 * 2026-11-05): small 4:5 arches on a phone, 9:10 ones from tablet, in a ScrollRail (no scrollbar;
 * arrows from tablet). The tiles stay server-rendered; only the rail is a client leaf.
 */
export function CategoryArches({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label={CATEGORY_COPY.nav} className="-mx-3 sm:-mx-6 lg:-mx-8">
      <ScrollRail className="gap-3 px-3 sm:px-6 md:gap-4 lg:gap-5 lg:px-8">
        {categories.map((category) => (
          <li key={category.slug} className="w-16 shrink-0 snap-start sm:w-18 md:w-28 lg:w-32">
            <Link prefetch={false} href={ROUTES.category(category.slug)} className="group block rounded-field">
              <span className="relative block aspect-4/5 overflow-hidden rounded-t-full rounded-b-field bg-muted md:aspect-9/10">
                <Image
                  src={category.heroImage}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 128px, (min-width: 768px) 112px, 72px"
                  className="object-cover transition-transform duration-slow ease-standard group-hover:scale-105 motion-reduce:transition-none"
                />
              </span>
              <span className="mt-2 flex items-center justify-center gap-2 md:justify-between">
                <span className="line-clamp-2 min-w-0 text-center text-caption font-medium text-foreground md:truncate md:text-left md:text-small">{category.name}</span>
                <Icon name="next" size="sm" tone="muted" className="hidden transition-transform duration-fast ease-standard group-hover:translate-x-0.5 md:block" />
              </span>
            </Link>
          </li>
        ))}
      </ScrollRail>
    </nav>
  );
}
