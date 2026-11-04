import Link from "next/link";

import { ErrorState } from "@/components/shared/states/ErrorState";
import { LatestOrdersList } from "@/components/order/console/OrdersTable";
import { adminOrdersDAL } from "@/data-access-layer/admin/orders.dal";
import { DASHBOARD_COPY } from "./dashboard-copy";
import { ROUTES } from "@server/shared/routes";

const LATEST = 5;

/** The newest orders, read on the server; the whole list is one link away. Fails alone. */
export async function LatestOrdersBlock({ retryHref }: { retryHref: string }) {
  let orders;
  try {
    ({ orders } = await adminOrdersDAL.list({ page: 1, limit: LATEST, sortBy: "createdAt", sortOrder: "desc" }));
  } catch (error) {
    console.error("[Admin dashboard] latest orders read failed:", error);
    return (
      <ErrorState
        title={DASHBOARD_COPY.latestFailed}
        description={DASHBOARD_COPY.nothingChanged}
        action={{ label: DASHBOARD_COPY.tryAgain, href: retryHref }}
        className="py-4"
      />
    );
  }

  return (
    <section aria-labelledby="latest-orders" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="latest-orders" className="text-title font-semibold text-foreground">
          {DASHBOARD_COPY.latestTitle}
        </h2>
        <Link href={ROUTES.admin.orders} prefetch={false} className="inline-flex min-h-10 items-center text-small font-medium text-primary hover:underline">
          {DASHBOARD_COPY.allOrders}
        </Link>
      </div>
      <LatestOrdersList orders={orders} />
    </section>
  );
}
