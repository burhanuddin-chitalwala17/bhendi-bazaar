/**
 * One order, in full — a server component ([ADR-0034]).
 *
 * Was a client page that fetched the order through `GET /api/admin/orders/[id]`, typed the
 * answer as the storefront's `Order`, and then reached past the mismatch with eleven `as any`
 * casts — including reading a `Json` column as a typed object with no parse behind it. The read
 * is now `adminOrdersDAL.detail`, whose shape is declared, and the one interactive part (the
 * tracking form and its edit toggle) is a leaf.
 */
import { notFound } from "next/navigation";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { Badge } from "@/components/ui/badge";
import { OrderDetailAside } from "@/components/order/console/OrderDetailAside";
import { ShipmentsPanel } from "@/components/order/console/ShipmentsPanel";
import { adminOrdersDAL } from "@/data-access-layer/admin/orders.dal";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";

export default async function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await adminOrdersDAL.detail(orderId);

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader overline="Order details" title={`Order ${order.code}`} />
        <div className="flex items-center gap-2">
          <Badge
            variant={
              order.paymentStatus === PAYMENT_STATUS.PAID
                ? "secondary"
                : order.paymentStatus === PAYMENT_STATUS.FAILED
                  ? "destructive"
                  : "outline"
            }
          >
            {order.paymentStatus}
          </Badge>
          <Badge variant={order.status === ORDER_STATUS.CONFIRMED ? "default" : "outline"}>
            {order.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <OrderDetailAside order={order} />
        </div>
        <div className="lg:col-span-2">
          <ShipmentsPanel shipments={order.shipments} />
        </div>
      </div>
    </div>
  );
}
