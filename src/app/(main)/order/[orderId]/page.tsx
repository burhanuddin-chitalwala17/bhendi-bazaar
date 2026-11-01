import { optionalActiveSession } from "@/lib/admin-auth";
import { OrderClient } from "@/components/order/order-client";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { ordersDAL } from "@/data-access-layer/orders.dal";
import { Suspense } from "react";

interface OrderPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderPage({ params }: OrderPageProps) {
  const { orderId } = await params;
  // A signed-in viewer may only open their own order; the DAL turns a mismatch into
  // "not found" so a foreign order id reveals nothing (checkout/CLAUDE.md ownership rule).
  const session = await optionalActiveSession({ onBlocked: "allow" });
  const order = await ordersDAL.getOrderById(orderId, session?.user?.id);
  if (!order) {
    return <ErrorState message="Order not found" />;
  }

  const [timelines, cancelView] = await Promise.all([ordersDAL.timelinesFor(order), ordersDAL.cancelViewFor(order)]);
  // Only the signed-in owner cancels here; a guest's page is readable by id alone (Q31).
  const viewerOwns = Boolean(session?.user?.id && order.userId === session.user.id);

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <OrderClient order={order} timelines={timelines} cancelView={cancelView} viewerOwns={viewerOwns} />
    </Suspense>
  );
}
