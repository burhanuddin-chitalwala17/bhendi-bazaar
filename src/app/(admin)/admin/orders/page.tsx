/**
 * Admin Orders Page — a server component ([ADR-0034]).
 *
 * Filters live in the URL, so the server answers the question the URL asks. The status is a tab
 * (a link); search and payment are the one client leaf.
 */
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { PageTabs } from "@/components/shared/page-tabs";
import { ORDER_TABS } from "@/components/order/console/order-status";
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

  const status = oneOf(Object.values(ORDER_STATUS), one("status"));
  const [{ orders, total, totalPages }, counts] = await Promise.all([
    adminOrdersDAL.list({
      search: one("search") || undefined,
      status,
      paymentStatus: oneOf(Object.values(PAYMENT_STATUS), one("paymentStatus")),
      page,
      limit,
      sortBy: resolveSortBy(one("sortBy"), SORTABLE, "createdAt"),
      sortOrder: resolveSortOrder(one("sortOrder")),
    }),
    adminOrdersDAL.statusCounts(),
  ]);

  // A tab keeps the search and payment filter; it starts again at page one.
  const tabHref = (tabStatus: string | null) => {
    const next = new URLSearchParams();
    for (const key of ["search", "paymentStatus"])
      if (one(key)) next.set(key, one(key)!);
    if (tabStatus) next.set("status", tabStatus);
    const query = next.toString();
    return query ? `/admin/orders?${query}` : "/admin/orders";
  };
  const all = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <PageShell width="wide">
      <PageHeader
        title="Orders"
        description="Every order on the platform, newest first."
      />

      <PageTabs
        label="Order status"
        current={status ?? "all"}
        tabs={ORDER_TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          href: tabHref(tab.status),
          count: tab.status ? counts[tab.status] : all,
        }))}
      />

      <OrdersFilters />

      <OrdersTable
        orders={orders}
        page={page}
        pageSize={limit}
        totalPages={totalPages}
        total={total}
      />
    </PageShell>
  );
}
