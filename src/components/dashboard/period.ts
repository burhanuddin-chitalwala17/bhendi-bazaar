import { isSalesPeriod, PERIOD_DAYS, SALES_PERIOD, type SalesPeriod } from "@server/analytics/sales.types";
import { PERIOD_COPY } from "@/components/dashboard/dashboard-copy";

/** A week unless the URL names a period we offer: an unknown value is ignored, never trusted. */
export function parsePeriod(raw: string | string[] | undefined): SalesPeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isSalesPeriod(value) ? value : SALES_PERIOD.WEEK;
}

export const PERIOD_OPTIONS: readonly { period: SalesPeriod; label: string }[] = [
  { period: SALES_PERIOD.TODAY, label: PERIOD_COPY.today },
  { period: SALES_PERIOD.WEEK, label: PERIOD_COPY.week },
  { period: SALES_PERIOD.MONTH, label: PERIOD_COPY.month },
];

/** "Sales, last 7 days"; "Sales today". */
export function periodTitle(period: SalesPeriod): string {
  return period === SALES_PERIOD.TODAY ? PERIOD_COPY.salesToday : PERIOD_COPY.salesLast(PERIOD_DAYS[period]);
}

/** What the previous figure is: "yesterday", "the 7 days before". */
export function previousLabel(period: SalesPeriod): string {
  return period === SALES_PERIOD.TODAY ? PERIOD_COPY.yesterday : PERIOD_COPY.daysBefore(PERIOD_DAYS[period]);
}

/** The chart's legend: "Last 7 days" beside "The 7 days before". */
export function legendLabels(period: SalesPeriod): { current: string; previous: string } {
  const previous = previousLabel(period);
  return {
    current: period === SALES_PERIOD.TODAY ? PERIOD_COPY.today : PERIOD_COPY.last(PERIOD_DAYS[period]),
    previous: previous.charAt(0).toUpperCase() + previous.slice(1),
  };
}
