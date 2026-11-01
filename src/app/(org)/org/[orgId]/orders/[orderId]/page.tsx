import Link from "next/link";
import { notFound } from "next/navigation";

import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ShopParcelCard } from "@/components/org/parcels/shop-parcel-card";
import { SHOP_PARCEL_COPY } from "@/components/org/parcels/parcel-copy";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { ShopOrdersRefused } from "@/components/org/parcels/shop-orders-refused";
import { shopScopeOrRefused } from "../shop-scope";

export const metadata = { robots: { index: false, follow: false } };

/**
 * One order, as the shop sees it (order-fulfilment ux.md "Shop parcel"): only its own parcels,
 * the buyer as name, city and pincode (D7, Q22). Not-found when no parcel of this shop is in it.
 */
export default async function OrgOrderDetailPage({ params }: { params: Promise<{ orgId: string; orderId: string }> }) {
  const { orgId: pathOrgId, orderId } = await params;
  const scope = await shopScopeOrRefused(pathOrgId);
  if (!scope) return <ShopOrdersRefused />;
  const orgId = scope.orgId;
  const order = await orgOrdersDAL.getOrder(orderId, orgId);
  if (!order) notFound();

  const [{ total: shopOrders }, timelines, fees] = await Promise.all([
    orgOrdersDAL.list(orgId, "all", 1),
    orgOrdersDAL.timelines(orderId, orgId),
    orgOrdersDAL.cancelFees(orderId, orgId),
  ]);
  const packing = order.parcels.filter((p) => p.status === SHIPMENT_STATUS.PACKING);

  return (
    <div className="max-w-4xl space-y-4 pb-24 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeader as="h1" title={order.code} />
        <Link href={`/org/${orgId}/orders`} className="min-h-10 text-sm text-primary hover:underline" prefetch={false}>
          {SHOP_PARCEL_COPY.allOrders}
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        {order.buyer.name} · {order.buyer.city}, {order.buyer.pincode}
      </p>

      {order.parcels.map((parcel) => (
        <ShopParcelCard
          key={parcel.id}
          orgId={orgId}
          parcel={parcel}
          firstOrder={shopOrders <= 1}
          docked={packing.length === 1}
          timeline={timelines[parcel.id]}
          feeNowPaise={fees.feePaise}
          feePaise={fees.charged[parcel.id]}
        />
      ))}

      <p className="text-xs text-muted-foreground">{SHOP_PARCEL_COPY.partial}</p>
    </div>
  );
}
