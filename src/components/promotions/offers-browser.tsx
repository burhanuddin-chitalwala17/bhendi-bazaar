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
import { OFFERS_BROWSER_COPY } from "./promotions-copy";

const STATUS_LABEL: Record<OfferStatus, string> = {
  [OFFER_STATUS.ALL]: OFFERS_BROWSER_COPY.statusAll,
  [OFFER_STATUS.LIVE]: OFFERS_BROWSER_COPY.statusLive,
  [OFFER_STATUS.SCHEDULED]: OFFERS_BROWSER_COPY.statusScheduled,
  [OFFER_STATUS.ENDED]: OFFERS_BROWSER_COPY.statusEnded,
  [OFFER_STATUS.STOPPED]: OFFERS_BROWSER_COPY.statusStopped,
};

const KIND_LABEL: Record<OfferKind, string> = {
  [OFFER_KIND.ALL]: OFFERS_BROWSER_COPY.kindAll,
  [OFFER_KIND.AUTOMATIC]: OFFERS_BROWSER_COPY.kindAutomatic,
  [OFFER_KIND.CODE]: OFFERS_BROWSER_COPY.kindCode,
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
        label={OFFERS_BROWSER_COPY.statusTabs}
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
          placeholder={OFFERS_BROWSER_COPY.searchPlaceholder}
          aria-label={OFFERS_BROWSER_COPY.searchLabel}
          className="md:flex-1"
        />
        <div className="flex gap-2">
          <div className="flex-1 md:w-40 md:flex-none">
            <Select name="kind" defaultValue={query.kind} aria-label={OFFERS_BROWSER_COPY.kindLabel}>
              {Object.values(OFFER_KIND).map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline">
            <Icon name="search" size="sm" />
            {OFFERS_BROWSER_COPY.search}
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
            ? { title: OFFERS_BROWSER_COPY.noMatchTitle, description: OFFERS_BROWSER_COPY.noMatchDescription, action: { label: OFFERS_BROWSER_COPY.clearFilters, href: basePath } }
            : { title: OFFERS_BROWSER_COPY.emptyTitle, description: OFFERS_BROWSER_COPY.emptyDescription, action: { label: OFFERS_BROWSER_COPY.newOffer, href: newHref } }
        }
        footer={
          pagination.totalPages > 1 && (
            <nav aria-label={OFFERS_BROWSER_COPY.pages} className="flex items-center justify-between gap-2 border-t border-border px-4 py-2">
              <p className="text-small text-muted-foreground tabular-nums">
                {OFFERS_BROWSER_COPY.page(pagination.page, pagination.totalPages, pagination.total)}
              </p>
              <div className="flex gap-2">
                {pagination.page > 1 && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={offersHref(basePath, query, { page: pagination.page - 1 })} prefetch={false} scroll={false}>
                      <Icon name="previous" size="sm" />
                      {OFFERS_BROWSER_COPY.previous}
                    </Link>
                  </Button>
                )}
                {pagination.page < pagination.totalPages && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={offersHref(basePath, query, { page: pagination.page + 1 })} prefetch={false} scroll={false}>
                      {OFFERS_BROWSER_COPY.next}
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
