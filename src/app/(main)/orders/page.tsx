// src/app/(main)/orders/page.tsx
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-config";
import { ordersDAL } from "@/data-access-layer/orders.dal";
import { OrdersClient } from "@/components/order/orders-client";
import { OrderLookup } from "@/components/order/order-lookup";

/**
 * A server component: the order list is rendered, not fetched ([ADR-0034]).
 *
 * This page was formerly a client component, which meant the list could only reach the database
 * through `GET /api/orders` — a round trip, and a spinner over data the server already
 * had. Only the search box needs the client, so only the search box is a client
 * component now.
 */
export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // A guest has no history to list; the lookup-by-code form is their route in.
    return <OrderLookup />;
  }

  return <OrdersClient orders={await ordersDAL.listForViewer()} />;
}
