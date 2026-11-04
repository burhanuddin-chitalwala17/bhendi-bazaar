import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { pickupsDAL } from "@/data-access-layer/admin/pickups.dal";
import { NotPackedList } from "@/components/order/pickups/not-packed-list";
import { PickupQueueList } from "@/components/order/pickups/pickup-queue-list";
import { ConflictList } from "@/components/order/pickups/conflict-list";
import {
  CONFLICTS_TAB,
  CONFLICT_COPY,
  NOT_PACKED_COPY,
  NOT_PACKED_TAB,
  QUEUE_COPY,
  pickupsHref as hrefOf,
} from "@/components/order/pickups/pickups-copy";
import { CONFLICTS_PAGE } from "@server/shipping/courier-conflict.service";
import { PICKUP_QUEUE_PAGE, PICKUP_QUEUE_TAB, isPickupQueueTab, type PickupQueueTab } from "@server/checkout/pickup-queue";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { PageTabs } from "@/components/shared/page-tabs";
import { ADMIN_ORDERS_COPY } from "../orders-copy";
import { ADMIN_SHELL_COPY } from "../../admin-copy";

export const metadata = { title: ADMIN_ORDERS_COPY.pickupsMetaTitle, robots: { index: false, follow: false } };


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
    <PageShell width="wide">
      <PageHeader title={NOT_PACKED_COPY.title} description={ADMIN_ORDERS_COPY.pickupsDescription} />
      <PageTabs
        label={ADMIN_ORDERS_COPY.pickupsTabs}
        current={tab}
        tabs={tabs.map((t) => ({
          key: t.key,
          label: t.label,
          count: t.count,
          href: unfiltered(t.key) ? hrefOf(t.key, {}) : hrefOf(t.key, { shop, city: t.key === NOT_PACKED_TAB ? undefined : city }),
        }))}
      />
      {((shop && !unfiltered(tab)) || (city && tab !== NOT_PACKED_TAB && !unfiltered(tab))) && (
        <div className="flex flex-wrap gap-2">
          {shop && !unfiltered(tab) && (
            <Button asChild size="sm" variant="outline">
              <Link href={hrefOf(tab, { city: tab === NOT_PACKED_TAB ? undefined : city })} prefetch={false}>
                <Icon name="close" size="xs" />
                {NOT_PACKED_COPY.allShops}
              </Link>
            </Button>
          )}
          {city && tab !== NOT_PACKED_TAB && !unfiltered(tab) && (
            <Button asChild size="sm" variant="outline">
              <Link href={hrefOf(tab, { shop })} prefetch={false}>
                <Icon name="close" size="xs" />
                {QUEUE_COPY.allCities}
              </Link>
            </Button>
          )}
        </div>
      )}

      {tab === CONFLICTS_TAB ? (
        <Conflicts shown={shown} />
      ) : tab === NOT_PACKED_TAB ? (
        <NotPacked shop={shop} now={now} />
      ) : (
        <Queue tab={tab} page={page} shop={shop} city={city} total={tab === PICKUP_QUEUE_TAB.READY ? ready : booked} />
      )}
    </PageShell>
  );
}

async function NotPacked({ shop, now }: { shop?: string; now: number }) {
  const rows = await pickupsDAL.notPacked(shop);
  return <NotPackedList rows={rows} now={now} />;
}

async function Conflicts({ shown }: { shown: number }) {
  const { rows, more } = await pickupsDAL.conflicts(shown);
  return (
    <>
      <ConflictList rows={rows} />
      {more && (
        <Button asChild size="sm" variant="outline">
          <Link href={hrefOf(CONFLICTS_TAB, { shown: shown + CONFLICTS_PAGE })} scroll={false} prefetch={false}>
            {CONFLICT_COPY.loadMore}
          </Link>
        </Button>
      )}
    </>
  );
}

async function Queue({ tab, page, shop, city, total }: { tab: PickupQueueTab; page: number; shop?: string; city?: string; total: number }) {
  const rows = await pickupsDAL.queue(tab, page, shop, city);
  const from = (page - 1) * PICKUP_QUEUE_PAGE + 1;
  const to = from + rows.length - 1;
  return (
    <>
      <PickupQueueList rows={rows} tab={tab} filter={{ shop, city }} />
      {(page > 1 || to < total) && (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-small" aria-label={ADMIN_SHELL_COPY.pages}>
          <span className="text-muted-foreground">{QUEUE_COPY.showing(from, to, total)}</span>
          <span className="flex gap-2">
            {page > 1 && (
              <Button asChild size="sm" variant="outline">
                <Link href={hrefOf(tab, { shop, city, page: page - 1 })} prefetch={false}>{QUEUE_COPY.previous}</Link>
              </Button>
            )}
            {to < total && (
              <Button asChild size="sm" variant="outline">
                <Link href={hrefOf(tab, { shop, city, page: page + 1 })} prefetch={false}>{QUEUE_COPY.next}</Link>
              </Button>
            )}
          </span>
        </nav>
      )}
    </>
  );
}

