import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { Category } from "@/domain/category";

/**
 * The only route back up the tree. Lane tiles point downwards only, so without
 * this trail a shopper arriving on a leaf from search has no way to the rest of
 * the shop but the logo.
 */
export function CategoryBreadcrumb({
  ancestors,
  current,
}: {
  ancestors: Category[];
  current: Category;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 sm:mb-3">
      <ol className="no-scrollbar flex items-center gap-1 overflow-x-auto text-[0.6875rem] text-muted-foreground sm:text-xs">
        <li className="shrink-0">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
        </li>
        {ancestors.map((ancestor) => (
          <li key={ancestor.slug} className="flex shrink-0 items-center gap-1">
            <ChevronRight className="size-3 shrink-0" aria-hidden />
            <Link
              href={`/category/${ancestor.slug}`}
              className="whitespace-nowrap hover:text-foreground"
            >
              {ancestor.name}
            </Link>
          </li>
        ))}
        <li className="flex shrink-0 items-center gap-1">
          <ChevronRight className="size-3 shrink-0" aria-hidden />
          <span
            aria-current="page"
            className="whitespace-nowrap font-medium text-foreground"
          >
            {current.name}
          </span>
        </li>
      </ol>
    </nav>
  );
}
