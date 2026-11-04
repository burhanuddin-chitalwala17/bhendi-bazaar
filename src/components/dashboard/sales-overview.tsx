import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { StatsCard } from "@/components/shared/stats-card";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { adminDashboardDAL } from "@/data-access-layer/admin/dashboard.dal";
import { bpsToPercent, formatCount, formatCurrency } from "@/lib/format";
import type { Compared, SalesPeriod } from "@server/analytics/sales.types";
import { legendLabels, periodTitle, previousLabel } from "./period";
import { SalesChart } from "./sales-chart";

/** +12.4% / −3% from basis points; null when there was nothing before to compare with. */
function change(c: Compared): { value: number; isPositive: boolean } | undefined {
  if (c.changeBps === null) return undefined;
  return { value: bpsToPercent(Math.abs(c.changeBps)), isPositive: c.changeBps >= 0 };
}

/** The lead card and the figures under it; fails alone, with a way to try again (D7). */
export async function SalesOverviewBlock({ period, retryHref }: { period: SalesPeriod; retryHref: string }) {
  const { sales } = await adminDashboardDAL.forPeriod(period);
  if (!sales.ok) {
    return (
      <Card className="p-4">
        <ErrorState
          title="Sales didn't load"
          description="The figures couldn't be read just now. Nothing was changed."
          action={{ label: "Try again", href: retryHref }}
          className="py-4"
        />
      </Card>
    );
  }

  const s = sales.value;
  const total = change(s.total);
  const before = previousLabel(period);
  const legend = legendLabels(period);

  return (
    <div className="space-y-4">
      <Card className="gap-4 p-4 md:p-6">
        <div className="space-y-1">
          <h2 className="text-small font-medium text-muted-foreground">{periodTitle(period)}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-heading text-display font-semibold tabular-nums text-foreground">{formatCurrency(s.total.current)}</p>
            {total && (
              <StatusBadge tone={total.isPositive ? "success" : "destructive"}>
                <span className="sr-only">{total.isPositive ? "Up" : "Down"} </span>
                {total.isPositive ? "+" : "−"}
                {total.value}%
              </StatusBadge>
            )}
          </div>
          <p className="text-small text-muted-foreground">
            vs {formatCurrency(s.total.previous)} {before}
          </p>
        </div>
        <SalesChart
          series={s.series}
          previousSeries={s.previousSeries}
          currentLabel={legend.current}
          previousLabel={legend.previous}
        />
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Paid orders" value={formatCount(s.orders.current)} trend={change(s.orders)} />
        <StatsCard title="Average order" value={formatCurrency(s.averageOrder.current)} trend={change(s.averageOrder)} />
        <StatsCard title="Platform kept" value={formatCurrency(s.platformKept.current)} trend={change(s.platformKept)} />
        <StatsCard title="Shops selling" value={formatCount(s.shopsSelling.current)} trend={change(s.shopsSelling)} />
      </div>
    </div>
  );
}
