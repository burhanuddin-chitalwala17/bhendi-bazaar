/**
 * Admin Orders Page — a server component ([ADR-0034]).
 *
 * Filters live in the URL, so the server answers the question the URL asks. Two client leaves
 * remain: the filter bar, and the status control on each row.
 */
import { SectionHeader } from "@/components/shared/SectionHeader";
import { adminOrdersDAL } from "@/data-access-layer/admin/orders.dal";
import { OrdersFilters } from "@/components/order/console/OrdersFilters";
import { OrdersTable } from "@/components/order/console/OrdersTable";
import {
  DEFAULT_PAGE_SIZE,
  resolvePageNumber,
  resolvePageSize,
  resolveSortBy,
  resolveSortOrder,
} from "@server/shared/pagination";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";

/** The columns this listing may be ordered by — the same set `OrderListFilters` declares. */
const SORTABLE = ["createdAt", "updatedAt", "total"] as const;

/** A filter value is only honoured if it names a real state (Invariant 4). */
const oneOf = <T extends string>(set: readonly T[], value?: string) =>
  set.includes(value as T) ? (value as T) : undefined;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = resolvePageNumber(one("page"));
  const limit = resolvePageSize(one("limit"), DEFAULT_PAGE_SIZE);

  const { orders, total, totalPages } = await adminOrdersDAL.list({
    search: one("search") || undefined,
    status: oneOf(Object.values(ORDER_STATUS), one("status")),
    paymentStatus: oneOf(Object.values(PAYMENT_STATUS), one("paymentStatus")),
    page,
    limit,
    sortBy: resolveSortBy(one("sortBy"), SORTABLE, "createdAt"),
    sortOrder: resolveSortOrder(one("sortOrder")),
  });

  return (
    <div className="space-y-6">
      <SectionHeader overline="Orders" title="Orders" />

      <div className="rounded-lg border border-border bg-card p-4">
        <OrdersFilters />
      </div>

      <OrdersTable
        orders={orders}
        page={page}
        pageSize={limit}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
