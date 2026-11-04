import Link from "next/link";

import { ErrorState } from "@/components/shared/states/ErrorState";
import { LatestOrdersList } from "@/components/order/console/OrdersTable";
import { adminOrdersDAL } from "@/data-access-layer/admin/orders.dal";

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
        title="Latest orders didn't load"
        description="Nothing was changed."
        action={{ label: "Try again", href: retryHref }}
        className="py-4"
      />
    );
  }

  return (
    <section aria-labelledby="latest-orders" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="latest-orders" className="text-title font-semibold text-foreground">
          Latest orders
        </h2>
        <Link href="/admin/orders" prefetch={false} className="inline-flex min-h-10 items-center text-small font-medium text-primary hover:underline">
          All orders
        </Link>
      </div>
      <LatestOrdersList orders={orders} />
    </section>
  );
}
