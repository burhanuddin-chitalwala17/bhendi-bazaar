import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
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
  const session = await getServerSession(authOptions);
  const order = await ordersDAL.getOrderById(orderId, session?.user?.id);
  if (!order) {
    return <ErrorState message="Order not found" />;
  }

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <OrderClient order={order} />
    </Suspense>
  );

}
