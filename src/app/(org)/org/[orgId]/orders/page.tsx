import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { PageHeader } from "@/components/shared/page-shell";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShopOrderList } from "@/components/org/parcels/shop-order-list";
import { ListFreshness } from "@/components/org/parcels/list-freshness";
import { SHOP_ORDERS_COPY, SHOP_TAB_EMPTY, SHOP_TAB_LABEL } from "@/components/org/parcels/parcel-copy";
import { SHOP_PARCEL_TAB, isShopParcelTab, type ShopParcelTab } from "@server/checkout/shop-parcel.types";
import { ShopOrdersRefused } from "@/components/org/parcels/shop-orders-refused";
import { shopScopeOrRefused } from "./shop-scope";
import { channelStockDAL } from "@/data-access-layer/channel-stock.dal";
import { MarketplaceOrders } from "@/components/channel/marketplace-orders";
import { MARKETPLACE_ORDERS } from "@/components/channel/stock-copy";

export const metadata = {
  title: "Orders",
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
  const tabs = (active: "store" | "marketplace") => (
    <nav className="flex gap-2" aria-label="Orders">
      {(["store", "marketplace"] as const).map((t) => (
        <Button key={t} asChild size="sm" variant={t === active ? "default" : "outline"} className="min-h-10">
          <Link href={t === "store" ? `/org/${orgId}/orders` : `/org/${orgId}/orders?tab=marketplace`} aria-current={t === active ? "page" : undefined}>
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
        <PageHeader help="orders" title="Orders" description="Sales on your connected marketplaces, as they reported them" />
        {tabs("marketplace")}
        <MarketplaceOrders orders={orders} hasMore={hasMore} moreHref={`/org/${orgId}/orders?tab=marketplace&more=${more + 1}`} />
      </div>
    );
  }

  const tab = isShopParcelTab(raw.status) ? raw.status : SHOP_PARCEL_TAB.TO_PACK;
  const pages = Math.max(1, Number.parseInt(typeof raw.more === "string" ? raw.more : "1", 10) || 1);
  const search = typeof raw.search === "string" ? raw.search.trim() : "";
  const { orders, hasMore } = await orgOrdersDAL.list(orgId, tab, pages, search || undefined);
  const firstUse = orders.length === 0 && !search && (await orgOrdersDAL.list(orgId, "all", 1)).total === 0;
  const tabHref = (t: ShopParcelTab) => `/org/${orgId}/orders?status=${t}`;
  const moreHref = `/org/${orgId}/orders?status=${tab}&more=${pages + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`;

  return (
    <div className="space-y-4">
      <PageHeader help="orders" title={SHOP_ORDERS_COPY.title} />
      {tabs("store")}
      <nav className="flex gap-2 overflow-x-auto" aria-label="Parcels">
        {Object.values(SHOP_PARCEL_TAB).map((t) => (
          <Button key={t} asChild size="sm" variant={t === tab ? "default" : "outline"} className="min-h-10 shrink-0">
            <Link href={tabHref(t)} aria-current={t === tab ? "page" : undefined}>
              {SHOP_TAB_LABEL[t]}
            </Link>
          </Button>
        ))}
      </nav>
      <form className="flex gap-2" action={`/org/${orgId}/orders`}>
        <input type="hidden" name="status" value={tab} />
        <Input name="search" defaultValue={search} placeholder={SHOP_ORDERS_COPY.search} aria-label={SHOP_ORDERS_COPY.search} className="min-h-10 flex-1" />
        <Button type="submit" variant="outline" className="min-h-10" aria-label={SHOP_ORDERS_COPY.search}>
          <Search className="size-4" />
        </Button>
      </form>
      <ListFreshness />

      {firstUse ? (
        <div className="rounded-card border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{SHOP_ORDERS_COPY.firstUse}</p>
          <Button asChild variant="outline" className="mt-3 min-h-10">
            <Link href={`/org/${orgId}/storefront`}>{SHOP_ORDERS_COPY.shareShop}</Link>
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <p className="rounded-card border bg-card p-6 text-center text-sm text-muted-foreground">{SHOP_TAB_EMPTY[tab]}</p>
      ) : (
        <ShopOrderList orders={orders} orderHref={(id) => `/org/${orgId}/orders/${id}`} />
      )}

      {hasMore && (
        <Button asChild variant="outline" className="min-h-10 w-full">
          <Link href={moreHref} scroll={false}>{SHOP_ORDERS_COPY.loadMore}</Link>
        </Button>
      )}
    </div>
  );
}
