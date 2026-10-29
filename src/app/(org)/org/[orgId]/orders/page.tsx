import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { OrgOrdersTable } from "@/components/org/org-orders-table";
import { OrgOrdersFilters } from "@/components/org/org-orders-filters";
import { resolvePageNumber, resolvePageSize } from "@server/shared/pagination";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ORDER_STATUS } from "@server/checkout/order.types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireOrgMember } from "@/lib/org-auth";
import { channelStockDAL } from "@/data-access-layer/channel-stock.dal";
import { MarketplaceOrders } from "@/components/channel/marketplace-orders";
import { MARKETPLACE_ORDERS } from "@/components/channel/stock-copy";

export const metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

const ALLOWED_STATUSES: Set<string> = new Set(Object.values(ORDER_STATUS));

export default async function OrgOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
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
    const scope = await requireOrgMember(orgId);
    const more = Math.max(1, Number.parseInt(typeof raw.more === "string" ? raw.more : "1", 10) || 1);
    const { orders, hasMore } = await channelStockDAL.orders(scope.orgId, more);
    return (
      <div className="space-y-6">
        <SectionHeader as="h1" title="Orders" description="Sales on your connected marketplaces, as they reported them" />
        {tabs("marketplace")}
        <MarketplaceOrders orders={orders} hasMore={hasMore} moreHref={`/org/${orgId}/orders?tab=marketplace&more=${more + 1}`} />
      </div>
    );
  }

  const page = typeof raw.page === "string" ? raw.page : undefined;
  const limit = typeof raw.limit === "string" ? raw.limit : undefined;
  const search = typeof raw.search === "string" ? raw.search.trim() : undefined;
  const rawStatus = typeof raw.status === "string" ? raw.status : undefined;
  const status = rawStatus && ALLOWED_STATUSES.has(rawStatus) ? rawStatus : undefined;

  const { orders, pagination } = await orgOrdersDAL.getOrders(
    orgId,
    resolvePageNumber(page),
    resolvePageSize(limit),
    { search: search || undefined, status: status || undefined },
  );

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" title="Orders" description="Orders with a parcel that ships from your organisation" />
      {tabs("store")}
      <OrgOrdersFilters />
      <OrgOrdersTable orders={orders} pagination={pagination} orgId={orgId} />
    </div>
  );
}
