import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { PageHeader } from "@/components/shared/page-shell";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageTabs } from "@/components/shared/page-tabs";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { Input } from "@/components/ui/input";
import { ShopOrderList } from "@/components/org/parcels/shop-order-list";
import { ListFreshness } from "@/components/org/parcels/list-freshness";
import { SHOP_ORDERS_COPY, SHOP_TAB_EMPTY, SHOP_TAB_LABEL } from "@/components/org/parcels/parcel-copy";
import { SHOP_PARCEL_TAB, isShopParcelTab, type ShopParcelTab } from "@server/checkout/shop-parcel.types";
import { ShopOrdersRefused } from "@/components/org/parcels/shop-orders-refused";
import { shopScopeOrRefused } from "./shop-scope";
import { channelStockDAL } from "@/data-access-layer/channel-stock.dal";
import { MarketplaceOrders } from "@/components/channel/marketplace-orders";
import { PlanBanner } from "@/components/subscriptions/plan-banner";
import { LOCK_COPY } from "@/components/subscriptions/subscriptions-copy";
import { MARKETPLACE_ORDERS } from "@/components/channel/stock-copy";
import { ROUTES } from "@server/shared/routes";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";
import { FEATURE } from "@/components/subscriptions/features";

export const metadata = {
  title: ORG_PAGE_TITLES.orders,
  robots: { index: false, follow: false },
};

export default async function OrgOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId: pathOrgId } = await params;
  const scope = await shopScopeOrRefused(pathOrgId);
  if (!scope) return <ShopOrdersRefused />;
  const orgId = scope.orgId;
  const raw = await searchParams;
  // Store or marketplace: a segmented control, two links, so each is a URL (inventory-sync Q10).
  const tabs = (active: "store" | "marketplace") => (
    <nav aria-label={SHOP_ORDERS_COPY.where} className="inline-flex rounded-field bg-muted p-1">
      {(["store", "marketplace"] as const).map((t) => (
        <Button key={t} asChild size="sm" variant={t === active ? "outline" : "ghost"} className={t === active ? "shadow-none" : "text-muted-foreground"}>
          <Link
            href={t === "store" ? ROUTES.org.orders(orgId) : `${ROUTES.org.orders(orgId)}?tab=marketplace`}
            prefetch={false}
            aria-current={t === active ? "page" : undefined}
          >
            {t === "store" ? MARKETPLACE_ORDERS.tabStore : MARKETPLACE_ORDERS.tabMarketplace}
          </Link>
        </Button>
      ))}
    </nav>
  );

  // Sales on Amazon and Flipkart, read-only (inventory-sync Q10).
  if (raw.tab === "marketplace") {
    const more = Math.max(1, Number.parseInt(typeof raw.more === "string" ? raw.more : "1", 10) || 1);
    const { orders, hasMore } = await channelStockDAL.orders(orgId, more);
    return (
      <div className="space-y-6">
        <PageHeader help="orders" title={SHOP_ORDERS_COPY.title} description={SHOP_ORDERS_COPY.marketplaceDescription} />
        {tabs("marketplace")}
        {!scope.features.channels && <PlanBanner feature={FEATURE.CHANNELS} />}
        {!scope.features.channels && orders.length === 0 ? (
          <p className="rounded-card border bg-card p-4 text-sm text-muted-foreground">{LOCK_COPY.marketplaceOrdersLocked}</p>
        ) : (
          <MarketplaceOrders orders={orders} hasMore={hasMore} moreHref={`${ROUTES.org.orders(orgId)}?tab=marketplace&more=${more + 1}`} />
        )}
      </div>
    );
  }

  const tab = isShopParcelTab(raw.status) ? raw.status : SHOP_PARCEL_TAB.TO_PACK;
  const pages = Math.max(1, Number.parseInt(typeof raw.more === "string" ? raw.more : "1", 10) || 1);
  const search = typeof raw.search === "string" ? raw.search.trim() : "";
  const [{ orders, hasMore }, counts] = await Promise.all([
    orgOrdersDAL.list(orgId, tab, pages, search || undefined),
    orgOrdersDAL.tabCounts(orgId),
  ]);
  const firstUse = orders.length === 0 && !search && (await orgOrdersDAL.list(orgId, "all", 1)).total === 0;
  const tabHref = (t: ShopParcelTab) => `${ROUTES.org.orders(orgId)}?status=${t}`;
  const moreHref = `${ROUTES.org.orders(orgId)}?status=${tab}&more=${pages + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`;

  return (
    <div className="space-y-4">
      <PageHeader help="orders" title={SHOP_ORDERS_COPY.title} />
      {tabs("store")}
      <PageTabs
        label={SHOP_ORDERS_COPY.status}
        current={tab}
        tabs={Object.values(SHOP_PARCEL_TAB).map((t) => ({ key: t, label: SHOP_TAB_LABEL[t], href: tabHref(t), count: counts[t] }))}
      />
      {tab === SHOP_PARCEL_TAB.TO_PACK && orders.length > 0 && <p className="text-small text-muted-foreground">{SHOP_ORDERS_COPY.toPackHint}</p>}
      <form className="flex gap-2" action={ROUTES.org.orders(orgId)}>
        <input type="hidden" name="status" value={tab} />
        <Input type="search" name="search" defaultValue={search} placeholder={SHOP_ORDERS_COPY.search} aria-label={SHOP_ORDERS_COPY.search} className="flex-1" />
        <Button type="submit" variant="outline" shape="icon" aria-label={SHOP_ORDERS_COPY.search}>
          <Icon name="search" size="sm" />
        </Button>
      </form>
      <ListFreshness />

      {firstUse ? (
        <EmptyState
          className="rounded-card border border-border bg-card px-4"
          title={SHOP_ORDERS_COPY.noOrders}
          description={SHOP_ORDERS_COPY.firstUse}
          action={{ label: SHOP_ORDERS_COPY.shareShop, href: ROUTES.org.shop(orgId) }}
        />
      ) : orders.length === 0 ? (
        <EmptyState className="rounded-card border border-border bg-card px-4" title={SHOP_TAB_EMPTY[tab]} description={SHOP_ORDERS_COPY.emptyTab} />
      ) : (
        <ShopOrderList orders={orders} orgId={orgId} orderHref={(id) => ROUTES.org.order(orgId, id)} />
      )}

      {hasMore && (
        <Button asChild variant="outline" className="w-full">
          <Link href={moreHref} scroll={false} prefetch={false}>{SHOP_ORDERS_COPY.loadMore}</Link>
        </Button>
      )}
    </div>
  );
}
