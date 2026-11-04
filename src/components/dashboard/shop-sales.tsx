import { orgSalesDAL } from "@/data-access-layer/org/sales.dal";
import { formatCount, formatCurrency } from "@/lib/format";
import type { SalesPeriod } from "@server/analytics/sales.types";
import { change, SalesFailed, SalesSummary } from "./sales-summary";
import { DASHBOARD_COPY } from "./dashboard-copy";

/**
 * A shop's sales block on its Home: the admin dashboard's grammar in the shop's colour (Q34).
 * `toPack` is Home's own read, passed in so the block does not query it twice.
 */
export async function ShopSalesBlock({
  orgId,
  period,
  retryHref,
  toPack,
}: {
  orgId: string;
  period: SalesPeriod;
  retryHref: string;
  toPack: number | null;
}) {
  const sales = await orgSalesDAL.forPeriod(orgId, period);
  if (!sales.ok) return <SalesFailed retryHref={retryHref} />;
  const s = sales.value;
  return (
    <SalesSummary
      tone="shop"
      period={period}
      total={s.total}
      series={s.series}
      previousSeries={s.previousSeries}
      figures={[
        { title: DASHBOARD_COPY.paidOrders, value: formatCount(s.orders.current), trend: change(s.orders) },
        { title: DASHBOARD_COPY.averageOrder, value: formatCurrency(s.averageOrder.current), trend: change(s.averageOrder) },
        { title: DASHBOARD_COPY.youllReceive, value: formatCurrency(s.payable.current), trend: change(s.payable) },
        ...(toPack === null ? [] : [{ title: DASHBOARD_COPY.toPackNow, value: formatCount(toPack) }]),
      ]}
    />
  );
}
