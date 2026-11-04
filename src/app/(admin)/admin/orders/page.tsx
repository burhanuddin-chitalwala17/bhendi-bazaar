/**
 * Admin Orders Page — a server component ([ADR-0034]).
 *
 * Filters live in the URL, so the server answers the question the URL asks. The status is a tab
 * (a link); search and payment are the one client leaf. From desktop `?order=` opens that order
 * beside the list (design-system Q36); Export CSV downloads the same view (Q37).
 */
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { OrderPeek } from "@/components/order/console/order-peek";
import { adminOrderViewSchema, orderPeekSchema } from "@/lib/validation/schemas/admin-order-list.schema";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { PageTabs } from "@/components/shared/page-tabs";
import { ORDER_TABS } from "@/components/order/console/order-status";
import { adminOrdersDAL } from "@/data-access-layer/admin/orders.dal";
import { OrdersFilters } from "@/components/order/console/OrdersFilters";
import { OrdersTable } from "@/components/order/console/OrdersTable";
import { DEFAULT_PAGE_SIZE, resolvePageNumber, resolvePageSize } from "@server/shared/pagination";

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

  // One schema for the list and its export, so the file is always the view on screen (Q37).
  const view = adminOrderViewSchema.parse(params);
  const { status } = view;
  const peekId = orderPeekSchema.parse(params.order);
  const [{ orders, total, totalPages }, counts, peek] = await Promise.all([
    adminOrdersDAL.list({ ...view, page, limit }),
    adminOrdersDAL.statusCounts(),
    peekId ? adminOrdersDAL.detail(peekId) : null,
  ]);

  const query = (drop: string[]) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v && !drop.includes(key)) next.set(key, v);
    }
    return next.toString();
  };
  const closeHref = `/admin/orders${query(["order"]) ? `?${query(["order"])}` : ""}`;
  const exportHref = `/api/admin/orders/export?${query(["order", "page", "limit"])}`;

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
        actions={
          <Button asChild variant="outline">
            {/* A download, so a plain link: the server writes the file for exactly this view. */}
            <a href={exportHref} download>
              <Icon name="download" size="sm" />
              Export CSV
            </a>
          </Button>
        }
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

      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="min-w-0 lg:flex-1">
          <OrdersTable
            orders={orders}
            peekId={peek ? peek.id : undefined}
            page={page}
            pageSize={limit}
            totalPages={totalPages}
            total={total}
          />
        </div>
        {/* Desktop only: below it a row opens the full page, so there is nothing to show here. */}
        {peek && (
          <div className="hidden lg:sticky lg:top-6 lg:block lg:w-96 lg:shrink-0">
            <OrderPeek order={peek} closeHref={closeHref} />
          </div>
        )}
      </div>
    </PageShell>
  );
}
