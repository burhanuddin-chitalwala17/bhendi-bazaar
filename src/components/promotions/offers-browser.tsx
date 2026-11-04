import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageTabs } from "@/components/shared/page-tabs";
import { OfferList } from "@/components/promotions/OfferList";
import {
  OFFER_KIND,
  OFFER_STATUS,
  type OfferKind,
  type OfferListQuery,
  type OfferListResult,
  type OfferStatus,
} from "@server/promotions/promotion.types";

const STATUS_LABEL: Record<OfferStatus, string> = {
  [OFFER_STATUS.ALL]: "All",
  [OFFER_STATUS.LIVE]: "Live",
  [OFFER_STATUS.SCHEDULED]: "Scheduled",
  [OFFER_STATUS.ENDED]: "Ended",
  [OFFER_STATUS.STOPPED]: "Stopped",
};

const KIND_LABEL: Record<OfferKind, string> = {
  [OFFER_KIND.ALL]: "Every kind",
  [OFFER_KIND.AUTOMATIC]: "Automatic",
  [OFFER_KIND.CODE]: "Codes",
};

/** The list's URL with some parameters changed; defaults are left out so a plain list is a plain URL. */
function offersHref(basePath: string, query: OfferListQuery, change: Partial<OfferListQuery>): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.status !== OFFER_STATUS.ALL) params.set("status", next.status);
  if (next.kind !== OFFER_KIND.ALL) params.set("kind", next.kind);
  if (next.search) params.set("search", next.search);
  if (next.sortBy !== "createdAt") params.set("sortBy", next.sortBy);
  if (next.sortBy !== "createdAt" || next.sortOrder !== "desc") params.set("sortOrder", next.sortOrder);
  if (next.page > 1) params.set("page", String(next.page));
  return params.size ? `${basePath}?${params}` : basePath;
}

/**
 * The offers list with its filters (offers list Q1): status tabs with counts, a search over name,
 * code and covered products, the kind, sort by column, and pages. Every filter is the URL, read
 * on the server; the form is a plain GET, so it works before any script loads.
 */
export function OffersBrowser({
  result,
  query,
  basePath,
  apiPath,
  newHref,
  now,
}: {
  result: OfferListResult;
  query: OfferListQuery;
  /** The list page, e.g. `/org/<id>/promotions`; edit links hang off it. */
  basePath: string;
  apiPath: string;
  newHref: string;
  now: Date;
}) {
  const { offers, pagination, counts } = result;
  const filtered = query.search !== "" || query.kind !== OFFER_KIND.ALL || query.status !== OFFER_STATUS.ALL;

  return (
    <div className="space-y-4">
      <PageTabs
        label="Offer status"
        current={query.status}
        tabs={Object.values(OFFER_STATUS).map((status) => ({
          key: status,
          label: STATUS_LABEL[status],
          href: offersHref(basePath, query, { status, page: 1 }),
          count: counts[status],
        }))}
      />

      <form action={basePath} className="flex flex-col gap-2 md:flex-row md:items-center">
        {query.status !== OFFER_STATUS.ALL && <input type="hidden" name="status" value={query.status} />}
        {query.sortBy !== "createdAt" && <input type="hidden" name="sortBy" value={query.sortBy} />}
        {query.sortBy !== "createdAt" && <input type="hidden" name="sortOrder" value={query.sortOrder} />}
        <Input
          type="search"
          name="search"
          defaultValue={query.search}
          placeholder="Search by name, code, product or SKU"
          aria-label="Search offers"
          className="md:flex-1"
        />
        <div className="flex gap-2">
          <div className="flex-1 md:w-40 md:flex-none">
            <Select name="kind" defaultValue={query.kind} aria-label="Kind of offer">
              {Object.values(OFFER_KIND).map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline">
            <Icon name="search" size="sm" />
            Search
          </Button>
        </div>
      </form>

      <OfferList
        offers={offers}
        now={now}
        basePath={basePath}
        apiPath={apiPath}
        empty={
          filtered
            ? { title: "No offers match", description: "Try another word, or clear the filters.", action: { label: "Clear filters", href: basePath } }
            : { title: "No offers yet", description: "An offer you create shows here.", action: { label: "New offer", href: newHref } }
        }
        footer={
          pagination.totalPages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-2 border-t border-border px-4 py-2">
              <p className="text-small text-muted-foreground tabular-nums">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} offers
              </p>
              <div className="flex gap-2">
                {pagination.page > 1 && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={offersHref(basePath, query, { page: pagination.page - 1 })} prefetch={false} scroll={false}>
                      <Icon name="previous" size="sm" />
                      Previous
                    </Link>
                  </Button>
                )}
                {pagination.page < pagination.totalPages && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={offersHref(basePath, query, { page: pagination.page + 1 })} prefetch={false} scroll={false}>
                      Next
                      <Icon name="next" size="sm" />
                    </Link>
                  </Button>
                )}
              </div>
            </nav>
          )
        }
      />
    </div>
  );
}
