import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { StatsCard } from "@/components/shared/stats-card";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { bpsToPercent, formatCurrency } from "@/lib/format";
import type { Compared, SalesDay, SalesPeriod } from "@server/analytics/sales.types";
import { legendLabels, periodTitle, previousLabel } from "./period";
import { SalesChart, type SalesTone } from "./sales-chart";

/** +12.4% / −3% from basis points; undefined when there was nothing before to compare with. */
export function change(c: Compared): { value: number; isPositive: boolean } | undefined {
  if (c.changeBps === null) return undefined;
  return { value: bpsToPercent(Math.abs(c.changeBps)), isPositive: c.changeBps >= 0 };
}

export interface SalesFigure {
  title: string;
  value: string;
  trend?: { value: number; isPositive: boolean };
}

/**
 * The control-panel sales block both dashboards share (design-system Q30, Q34): the period's
 * total, its change, the chart, and four figures under it. Only the tone tells them apart.
 */
export function SalesSummary({
  period,
  total,
  series,
  previousSeries,
  figures,
  tone,
}: {
  period: SalesPeriod;
  total: Compared;
  series: readonly SalesDay[];
  previousSeries: readonly SalesDay[];
  figures: readonly SalesFigure[];
  tone: SalesTone;
}) {
  const trend = change(total);
  const legend = legendLabels(period);
  return (
    <div className="space-y-4">
      <Card className="gap-4 p-4 md:p-6">
        <div className="space-y-1">
          <h2 className="text-small font-medium text-muted-foreground">{periodTitle(period)}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-heading text-display font-semibold tabular-nums text-foreground">{formatCurrency(total.current)}</p>
            {trend && (
              <StatusBadge tone={trend.isPositive ? "success" : "destructive"}>
                <span className="sr-only">{trend.isPositive ? "Up" : "Down"} </span>
                {trend.isPositive ? "+" : "−"}
                {trend.value}%
              </StatusBadge>
            )}
          </div>
          <p className="text-small text-muted-foreground">
            vs {formatCurrency(total.previous)} {previousLabel(period)}
          </p>
        </div>
        <SalesChart
          tone={tone}
          series={series}
          previousSeries={previousSeries}
          currentLabel={legend.current}
          previousLabel={legend.previous}
        />
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((f) => (
          <StatsCard key={f.title} title={f.title} value={f.value} trend={f.trend} />
        ))}
      </div>
    </div>
  );
}

/** The block failed on its own; the rest of the page stands (D7). */
export function SalesFailed({ retryHref }: { retryHref: string }) {
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
