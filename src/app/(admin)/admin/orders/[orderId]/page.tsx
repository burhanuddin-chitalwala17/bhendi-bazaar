/**
 * One order, in full — a server component ([ADR-0034]).
 *
 * Was a client page that fetched the order through `GET /api/admin/orders/[id]`, typed the
 * answer as the storefront's `Order`, and then reached past the mismatch with eleven `as any`
 * casts — including reading a `Json` column as a typed object with no parse behind it. The read
 * is now `adminOrdersDAL.detail`, whose shape is declared, and the interactive parts (book, re-date,
 * mark picked up — order-fulfilment D11) are leaves.
 */
import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { orderChip, paymentChip } from "@/components/order/console/order-status";
import { OrderDetailAside } from "@/components/order/console/OrderDetailAside";
import { ShipmentsPanel } from "@/components/order/console/ShipmentsPanel";
import { adminOrdersDAL } from "@/data-access-layer/admin/orders.dal";
import { PAYMENT_STATUS } from "@server/checkout/order.types";

export default async function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await adminOrdersDAL.detail(orderId);

  if (!order) notFound();
  const timelines = await adminOrdersDAL.timelines(orderId);
  const status = orderChip(order.status);
  const payment = paymentChip(order.paymentStatus);

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Order"
        title={order.code}
        back={{ href: "/admin/orders", label: "Orders" }}
        actions={
          <>
            <StatusBadge tone={status.tone} dot>
              {status.label}
            </StatusBadge>
            <StatusBadge tone={payment.tone}>{payment.label}</StatusBadge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <OrderDetailAside order={order} />
        </div>
        <div className="lg:col-span-2">
          <ShipmentsPanel shipments={order.shipments} timelines={timelines} paid={order.paymentStatus === PAYMENT_STATUS.PAID} />
        </div>
      </div>
    </PageShell>
  );
}
