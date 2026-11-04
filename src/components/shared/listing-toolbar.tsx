import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ProductSortSelect } from "@/components/shared/product-sort-select";
import { formatCount } from "@/lib/format";
import { PRODUCT_SORTS, type ProductSort } from "@/lib/product-paging";

/** One filter a listing offers, as a URL parameter, so a filtered listing can be shared and reopened. */
export interface ListingFilter {
  label: string;
  param: string;
  value: string;
}

/** The URL with one parameter toggled; paging restarts, since page two of another listing means nothing. */
export function toggledHref(basePath: string, params: Record<string, string | undefined>, filter: ListingFilter): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && key !== "page") next.set(key, value);
  if (next.get(filter.param) === filter.value) next.delete(filter.param);
  else next.set(filter.param, filter.value);
  return next.size ? `${basePath}?${next}` : basePath;
}

/** An unknown sort is the default, never an error: it arrives from a hand-typed URL. */
export const parseSort = (raw?: string): ProductSort =>
  (PRODUCT_SORTS as readonly string[]).includes(raw ?? "") ? (raw as ProductSort) : "newest";

export function countLabel(count: number, noun: { one: string; many: string } = { one: "piece", many: "pieces" }): string {
  return `${formatCount(count)} ${count === 1 ? noun.one : noun.many}`;
}

/**
 * A listing's count, sort and filters (storefront Q12, StoreCategory canvas). Filters are links
 * that toggle a URL parameter; the sort is the shared select, also in the URL.
 */
export function ListingToolbar({
  basePath,
  params,
  count,
  filters = [],
}: {
  basePath: string;
  /** The page's current search parameters, carried through every toggle. */
  params: Record<string, string | undefined>;
  count: number;
  filters?: ListingFilter[];
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-1 text-small text-muted-foreground" aria-live="polite">
          {countLabel(count)}
        </p>
        {filters.map((filter) => {
          const on = params[filter.param] === filter.value;
          return (
            <Button key={filter.param} asChild size="sm" variant={on ? "default" : "outline"} className="rounded-full">
              <Link href={toggledHref(basePath, params, filter)} prefetch={false} aria-current={on ? "true" : undefined} scroll={false}>
                {on && <Icon name="done" size="xs" />}
                {filter.label}
              </Link>
            </Button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Icon name="choose" size="sm" tone="muted" />
        <ProductSortSelect basePath={basePath} />
      </div>
    </div>
  );
}
