import { adminDashboardDAL } from "@/data-access-layer/admin/dashboard.dal";
import { formatCount, formatCurrency } from "@/lib/format";
import type { SalesPeriod } from "@server/analytics/sales.types";
import { change, SalesFailed, SalesSummary } from "./sales-summary";
import { DASHBOARD_COPY } from "./dashboard-copy";

/** The platform's sales block; fails alone, with a way to try again (D7). */
export async function SalesOverviewBlock({ period, retryHref }: { period: SalesPeriod; retryHref: string }) {
  const { sales } = await adminDashboardDAL.forPeriod(period);
  if (!sales.ok) return <SalesFailed retryHref={retryHref} />;
  const s = sales.value;
  return (
    <SalesSummary
      tone="platform"
      period={period}
      total={s.total}
      series={s.series}
      previousSeries={s.previousSeries}
      figures={[
        { title: DASHBOARD_COPY.paidOrders, value: formatCount(s.orders.current), trend: change(s.orders) },
        { title: DASHBOARD_COPY.averageOrder, value: formatCurrency(s.averageOrder.current), trend: change(s.averageOrder) },
        { title: DASHBOARD_COPY.platformKept, value: formatCurrency(s.platformKept.current), trend: change(s.platformKept) },
        { title: DASHBOARD_COPY.shopsSelling, value: formatCount(s.shopsSelling.current), trend: change(s.shopsSelling) },
      ]}
    />
  );
}
