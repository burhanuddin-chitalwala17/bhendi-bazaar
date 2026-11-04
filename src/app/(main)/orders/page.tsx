import { optionalActiveSession } from "@/lib/admin-auth";
import { ordersDAL } from "@/data-access-layer/orders.dal";
import { OrdersClient } from "@/components/order/orders-client";
import { OrderLookup } from "@/components/order/order-lookup";

/** The order list is rendered, not fetched (ADR-0034); only the search box is a client component. */
export default async function OrdersPage() {
  const session = await optionalActiveSession({ onBlocked: "allow" });
  if (!session?.user?.id) {
    // A guest has no history to list; the lookup-by-code form is their route in.
    return <OrderLookup />;
  }

  return <OrdersClient orders={await ordersDAL.listForViewer()} />;
}
