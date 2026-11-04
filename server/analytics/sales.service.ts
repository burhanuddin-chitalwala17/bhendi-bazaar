import { indiaToday } from "@server/shared/india-time";
import { salesRepository, type SalesWindows } from "@server/analytics/sales.repository";
import { PERIOD_DAYS, type Compared, type SalesDay, type SalesOverview, type SalesPeriod, type ShopSalesOverview } from "@server/analytics/sales.types";

const DAY_MS = 86_400_000;
/** India has no daylight saving, so its midnight is a fixed offset from UTC's. */
const INDIA_OFFSET = "+05:30";

/** "2026-11-04" plus `days`, as a calendar day. */
const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * The period is the last N India days, today included and today only so far; the previous period
 * is the N days before it, cut at the same time of day, so "today" is compared with yesterday up
 * to this hour rather than with all of yesterday.
 */
export function salesWindows(period: SalesPeriod, now: Date): SalesWindows & { days: string[]; previousDays: string[] } {
  const n = PERIOD_DAYS[period];
  const firstDay = addDays(indiaToday(now), -(n - 1));
  const from = new Date(`${firstDay}T00:00:00${INDIA_OFFSET}`);
  const span = n * DAY_MS;
  const days = Array.from({ length: n }, (_, i) => addDays(firstDay, i));
  return {
    from,
    to: now,
    previousFrom: new Date(from.getTime() - span),
    previousTo: new Date(now.getTime() - span),
    days,
    previousDays: days.map((day) => addDays(day, -n)),
  };
}

/** Change in basis points, half away from zero; null when there is nothing to compare with. */
export function compare(current: number, previous: number): Compared {
  const changeBps = previous === 0 ? null : Math.sign(current - previous) * Math.round((Math.abs(current - previous) * 10_000) / Math.abs(previous));
  return { current, previous, changeBps };
}

/** Integer paise per order, half up. */
export const averagePaise = (totalPaise: number, orders: number) => (orders === 0 ? 0 : Math.round(totalPaise / orders));

/** The admin dashboard's sales block: two statements whatever the period. */
export async function salesOverview(period: SalesPeriod, now: Date = new Date()): Promise<SalesOverview> {
  const w = salesWindows(period, now);
  const [rows, figures] = await Promise.all([salesRepository.byDay(w), salesRepository.figures(w)]);
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const fill = (day: string): SalesDay => ({ day, paise: byDay.get(day)?.paise ?? 0, orders: byDay.get(day)?.orders ?? 0 });
  const series = w.days.map(fill);
  const previousSeries = w.previousDays.map(fill);
  const sum = (list: SalesDay[], field: "paise" | "orders") => list.reduce((acc, d) => acc + d[field], 0);
  const total = compare(sum(series, "paise"), sum(previousSeries, "paise"));
  const orders = compare(sum(series, "orders"), sum(previousSeries, "orders"));

  return {
    period,
    window: {
      from: w.from.toISOString(),
      to: w.to.toISOString(),
      previousFrom: w.previousFrom.toISOString(),
      previousTo: w.previousTo.toISOString(),
    },
    series,
    previousSeries,
    total,
    orders,
    averageOrder: compare(averagePaise(total.current, orders.current), averagePaise(total.previous, orders.previous)),
    platformKept: compare(figures.kept, figures.previousKept),
    shopsSelling: compare(figures.shops, figures.previousShops),
  };
}

/** One shop's sales block on its Home (Q34): one statement whatever the period. */
export async function shopSalesOverview(orgId: string, period: SalesPeriod, now: Date = new Date()): Promise<ShopSalesOverview> {
  const w = salesWindows(period, now);
  const byDay = new Map((await salesRepository.shopByDay(w, orgId)).map((row) => [row.day, row]));
  const fill = (day: string): SalesDay => ({ day, paise: byDay.get(day)?.paise ?? 0, orders: byDay.get(day)?.orders ?? 0 });
  const series = w.days.map(fill);
  const previousSeries = w.previousDays.map(fill);
  const sum = (list: SalesDay[], field: "paise" | "orders") => list.reduce((acc, d) => acc + d[field], 0);
  const payableOf = (days: string[]) => days.reduce((acc, day) => acc + (byDay.get(day)?.payable ?? 0), 0);
  const total = compare(sum(series, "paise"), sum(previousSeries, "paise"));
  const orders = compare(sum(series, "orders"), sum(previousSeries, "orders"));
  return {
    period,
    series,
    previousSeries,
    total,
    orders,
    averageOrder: compare(averagePaise(total.current, orders.current), averagePaise(total.previous, orders.previous)),
    payable: compare(payableOf(w.days), payableOf(w.previousDays)),
  };
}
