import Link from "next/link";

import type { Category } from "@/domain/category";
import { Icon } from "@/components/ui/icon";

/** The only route back up the tree: lane tiles point downwards only. */
export function CategoryBreadcrumb({
  ancestors,
  current,
}: {
  ancestors: Category[];
  current: Category;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="no-scrollbar flex items-center gap-1 overflow-x-auto text-caption text-muted-foreground">
        <li className="shrink-0">
          <Link href="/" className="inline-flex min-h-10 items-center hover:text-foreground md:min-h-0" prefetch={false}>
            Home
          </Link>
        </li>
        {ancestors.map((ancestor) => (
          <li key={ancestor.slug} className="flex shrink-0 items-center gap-1">
            <Icon name="next" size="xs" />
            <Link
              prefetch={false}
              href={`/category/${ancestor.slug}`}
              className="whitespace-nowrap hover:text-foreground"
            >
              {ancestor.name}
            </Link>
          </li>
        ))}
        <li className="flex shrink-0 items-center gap-1">
          <Icon name="next" size="xs" />
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
