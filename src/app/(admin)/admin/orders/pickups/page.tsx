import Link from "next/link";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";
import { pickupsDAL } from "@/data-access-layer/admin/pickups.dal";
import { NotPackedList } from "@/components/order/pickups/not-packed-list";
import { PickupQueueList } from "@/components/order/pickups/pickup-queue-list";
import { ConflictList } from "@/components/order/pickups/conflict-list";
import { CONFLICTS_TAB, CONFLICT_COPY, NOT_PACKED_COPY, QUEUE_COPY } from "@/components/order/pickups/pickups-copy";
import { CONFLICTS_PAGE } from "@server/shipping/courier-conflict.service";
import { PICKUP_QUEUE_PAGE, PICKUP_QUEUE_TAB, isPickupQueueTab, type PickupQueueTab } from "@server/checkout/pickup-queue";

export const metadata = { title: "Pickups", robots: { index: false, follow: false } };

const NOT_PACKED_TAB = "not-packed";
const BASE = "/admin/orders/pickups";

/** A pickups URL keeping only the filters given; `page` 1 is left out. */
function hrefOf(tab: string, filter: { shop?: string; city?: string; page?: number; shown?: number }): string {
  const q = new URLSearchParams({ tab });
  if (filter.shown) q.set("shown", String(filter.shown));
  if (filter.shop) q.set("shop", filter.shop);
  if (filter.city) q.set("city", filter.city);
  if (filter.page && filter.page > 1) q.set("page", String(filter.page));
  return `${BASE}?${q.toString()}`;
}

/**
 * The admin's pickup queue (order-fulfilment ux.md "admin pickups", R4, R5): Ready to book, oldest
 * first; Booked, by pickup date, overdue in red; Not packed, paid 36 h on (R3a); Conflicts,
 * courier updates we could not apply (R8).
 */
export default async function AdminPickupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab =
    params.tab === NOT_PACKED_TAB || params.tab === CONFLICTS_TAB ? params.tab : isPickupQueueTab(params.tab) ? params.tab : PICKUP_QUEUE_TAB.READY;
  const shop = typeof params.shop === "string" && params.shop ? params.shop : undefined;
  const city = typeof params.city === "string" && params.city ? params.city : undefined;
  const page = Math.max(1, Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const now = Date.now();
  // Capped: each "Load more" adds 50, and a hand-typed number should not read the whole table.
  const shown = Math.min(1000, Math.max(CONFLICTS_PAGE, Number.parseInt(typeof params.shown === "string" ? params.shown : "", 10) || CONFLICTS_PAGE));
  const [ready, booked, notPacked, conflicts] = await Promise.all([
    pickupsDAL.queueCount(PICKUP_QUEUE_TAB.READY, shop, city),
    pickupsDAL.queueCount(PICKUP_QUEUE_TAB.BOOKED, shop, city),
    pickupsDAL.notPackedCount(shop),
    pickupsDAL.openConflictCount(),
  ]);
  const tabs = [
    { key: PICKUP_QUEUE_TAB.READY, label: QUEUE_COPY.ready, count: ready },
    { key: PICKUP_QUEUE_TAB.BOOKED, label: QUEUE_COPY.booked, count: booked },
    { key: NOT_PACKED_TAB, label: NOT_PACKED_COPY.tab, count: notPacked },
    { key: CONFLICTS_TAB, label: CONFLICT_COPY.tab, count: conflicts },
  ];
  // Conflicts belong to no shop or city, so its link and its view carry no filter.
  const unfiltered = (key: string) => key === CONFLICTS_TAB;

  return (
    <div className="space-y-4">
      <SectionHeader as="h1" title={NOT_PACKED_COPY.title} />
      <nav className="flex flex-wrap gap-2" aria-label="Pickups">
        {tabs.map((t) => (
          <Button key={t.key} asChild size="sm" variant={t.key === tab ? "default" : "outline"} className="min-h-10">
            <Link
              href={unfiltered(t.key) ? hrefOf(t.key, {}) : hrefOf(t.key, { shop, city: t.key === NOT_PACKED_TAB ? undefined : city })}
              aria-current={t.key === tab ? "page" : undefined}
            >
              {t.label} · {t.count}
            </Link>
          </Button>
        ))}
        {shop && !unfiltered(tab) && (
          <Button asChild size="sm" variant="outline" className="min-h-10">
            <Link href={hrefOf(tab, { city: tab === NOT_PACKED_TAB ? undefined : city })}>{NOT_PACKED_COPY.allShops}</Link>
          </Button>
        )}
        {city && tab !== NOT_PACKED_TAB && !unfiltered(tab) && (
          <Button asChild size="sm" variant="outline" className="min-h-10">
            <Link href={hrefOf(tab, { shop })}>{QUEUE_COPY.allCities}</Link>
          </Button>
        )}
      </nav>

      {tab === CONFLICTS_TAB ? (
        <Conflicts shown={shown} />
      ) : tab === NOT_PACKED_TAB ? (
        <NotPacked shop={shop} now={now} />
      ) : (
        <Queue tab={tab} page={page} shop={shop} city={city} total={tab === PICKUP_QUEUE_TAB.READY ? ready : booked} />
      )}
    </div>
  );
}

async function NotPacked({ shop, now }: { shop?: string; now: number }) {
  const rows = await pickupsDAL.notPacked(shop);
  if (rows.length === 0) return <Empty text={NOT_PACKED_COPY.empty} />;
  return <NotPackedList rows={rows} now={now} />;
}

async function Conflicts({ shown }: { shown: number }) {
  const { rows, more } = await pickupsDAL.conflicts(shown);
  if (rows.length === 0) return <Empty text={CONFLICT_COPY.empty} />;
  return (
    <>
      <ConflictList rows={rows} />
      {more && (
        <Button asChild size="sm" variant="outline" className="min-h-10">
          <Link href={hrefOf(CONFLICTS_TAB, { shown: shown + CONFLICTS_PAGE })} scroll={false}>
            {CONFLICT_COPY.loadMore}
          </Link>
        </Button>
      )}
    </>
  );
}

async function Queue({ tab, page, shop, city, total }: { tab: PickupQueueTab; page: number; shop?: string; city?: string; total: number }) {
  const rows = await pickupsDAL.queue(tab, page, shop, city);
  if (rows.length === 0) return <Empty text={QUEUE_COPY.empty} />;
  const from = (page - 1) * PICKUP_QUEUE_PAGE + 1;
  const to = from + rows.length - 1;
  return (
    <>
      <PickupQueueList rows={rows} tab={tab} filterHref={(f) => hrefOf(tab, { shop, city, ...f })} />
      {(page > 1 || to < total) && (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-sm" aria-label="Pages">
          <span className="text-muted-foreground">{QUEUE_COPY.showing(from, to, total)}</span>
          <span className="flex gap-2">
            {page > 1 && (
              <Button asChild size="sm" variant="outline" className="min-h-10">
                <Link href={hrefOf(tab, { shop, city, page: page - 1 })}>{QUEUE_COPY.previous}</Link>
              </Button>
            )}
            {to < total && (
              <Button asChild size="sm" variant="outline" className="min-h-10">
                <Link href={hrefOf(tab, { shop, city, page: page + 1 })}>{QUEUE_COPY.next}</Link>
              </Button>
            )}
          </span>
        </nav>
      )}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-card border bg-card p-6 text-center text-sm text-muted-foreground">{text}</p>;
}
