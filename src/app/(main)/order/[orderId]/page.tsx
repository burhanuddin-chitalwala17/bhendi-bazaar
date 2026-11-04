import { optionalActiveSession } from "@/lib/admin-auth";
import { OrderClient } from "@/components/order/order-client";
import { ordersDAL } from "@/data-access-layer/orders.dal";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { ORDER_PAGE_COPY } from "./order-page-copy";
import { ROUTES } from "@server/shared/routes";

interface OrderPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { orderId } = await params;
  // A signed-in viewer may only open their own order; the DAL turns a mismatch into
  // "not found" so a foreign order id reveals nothing (checkout/CLAUDE.md ownership rule).
  const session = await optionalActiveSession({ onBlocked: "allow" });
  const order = await ordersDAL.getOrderById(orderId, session?.user?.id);
  // In-page, not a 404: loading.tsx has already streamed a 200, and an order page is never indexed.
  if (!order) return <ErrorState as="h1" title={ORDER_PAGE_COPY.notFoundTitle} description={ORDER_PAGE_COPY.notFoundBody} action={{ label: ORDER_PAGE_COPY.yourOrders, href: ROUTES.orders }} />;

  const [timelines, cancelView] = await Promise.all([ordersDAL.timelinesFor(order), ordersDAL.cancelViewFor(order)]);
  // Only the signed-in owner cancels here; a guest's page is readable by id alone (Q31).
  const viewerOwns = Boolean(session?.user?.id && order.userId === session.user.id);

  // No Suspense here: everything is awaited above, so a boundary could never show; loading.tsx covers the wait.
  return <OrderClient order={order} timelines={timelines} cancelView={cancelView} viewerOwns={viewerOwns} />;
}
