import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import type { Category } from "@/domain/category";

/**
 * Home's top-level categories as arch-topped pictures, sized as StoreHome draws them: a line of small
 * 4:5 arches on a phone (five in view), a grid of tall 9:10 ones from tablet. A server component.
 */
export function CategoryArches({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Categories" className="-mx-3 sm:-mx-6 md:mx-0">
      <ul className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-3 sm:px-6 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-5 lg:gap-5">
        {categories.map((category) => (
          <li key={category.slug} className="w-18 shrink-0 snap-start sm:w-20 md:w-auto">
            <Link prefetch={false} href={`/category/${category.slug}`} className="group block rounded-field">
              <span className="relative block aspect-4/5 overflow-hidden rounded-t-full rounded-b-field bg-muted md:aspect-9/10">
                <Image
                  src={category.heroImage}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, 80px"
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
      </ul>
    </nav>
  );
}
