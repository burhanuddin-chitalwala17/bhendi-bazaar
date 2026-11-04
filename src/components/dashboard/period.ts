import { isSalesPeriod, PERIOD_DAYS, SALES_PERIOD, type SalesPeriod } from "@server/analytics/sales.types";

/** A week unless the URL names a period we offer: an unknown value is ignored, never trusted. */
export function parsePeriod(raw: string | string[] | undefined): SalesPeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isSalesPeriod(value) ? value : SALES_PERIOD.WEEK;
}

export const PERIOD_OPTIONS: readonly { period: SalesPeriod; label: string }[] = [
  { period: SALES_PERIOD.TODAY, label: "Today" },
  { period: SALES_PERIOD.WEEK, label: "7 days" },
  { period: SALES_PERIOD.MONTH, label: "30 days" },
];

/** "Sales, last 7 days"; "Sales today". */
export function periodTitle(period: SalesPeriod): string {
  return period === SALES_PERIOD.TODAY ? "Sales today" : `Sales, last ${PERIOD_DAYS[period]} days`;
}

/** What the previous figure is: "yesterday", "the 7 days before". */
export function previousLabel(period: SalesPeriod): string {
  return period === SALES_PERIOD.TODAY ? "yesterday" : `the ${PERIOD_DAYS[period]} days before`;
}

/** The chart's legend: "Last 7 days" beside "The 7 days before". */
export function legendLabels(period: SalesPeriod): { current: string; previous: string } {
  const previous = previousLabel(period);
  return {
    current: period === SALES_PERIOD.TODAY ? "Today" : `Last ${PERIOD_DAYS[period]} days`,
    previous: previous.charAt(0).toUpperCase() + previous.slice(1),
  };
}
