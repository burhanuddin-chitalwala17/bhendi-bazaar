import Link from "next/link";

import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { ShopOrderList } from "@/components/org/parcels/shop-order-list";
import { Button } from "@/components/ui/button";
import { SHOP_ORDERS_COPY } from "@/components/org/parcels/parcel-copy";
import { ROUTES } from "@server/shared/routes";

interface Props {
  orgId: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** An org's parcels, as the shop sees them, in the admin's org console; rows open the admin order. */
export async function AdminOrgOrders({ orgId, searchParams }: Props) {
  const params = await searchParams;
  const raw = Array.isArray(params.more) ? params.more[0] : params.more;
  const pages = Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
  const { orders, hasMore } = await orgOrdersDAL.list(orgId, "all", pages);

  return (
    <div className="space-y-3">
      <ShopOrderList orders={orders} orderHref={(orderId) => ROUTES.admin.order(orderId)} />
      {hasMore && (
        <Button asChild variant="outline" className="min-h-10 w-full">
          <Link href={`${ROUTES.admin.org(orgId)}?tab=orders&more=${pages + 1}`} scroll={false}>{SHOP_ORDERS_COPY.loadMore}</Link>
        </Button>
      )}
    </div>
  );
}
