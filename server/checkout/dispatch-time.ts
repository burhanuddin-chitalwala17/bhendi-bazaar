import { readyTimesForOrg } from "@server/shipping/shipment-status.service";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Recent enough to describe the shop today, wide enough to have parcels in it. */
export const DISPATCH_WINDOW_DAYS = 90;
export const DISPATCH_SAMPLE = 50;
/** Under this many parcels a median is an anecdote; the figure is left out, never shown small (R8, Q39). */
export const MIN_DISPATCH_PARCELS = 3;

/** Whole days from paid to ready, the median rounded down: 0 is "today" (Q38). Null under the floor. */
export function medianDispatchDays(times: ReadonlyArray<{ paidAt: Date; readyAt: Date }>): number | null {
  if (times.length < MIN_DISPATCH_PARCELS) return null;
  const spans = times
    .map(({ paidAt, readyAt }) => Math.max(0, readyAt.getTime() - paidAt.getTime()))
    .sort((a, b) => a - b);
  const mid = Math.floor(spans.length / 2);
  const median = spans.length % 2 ? spans[mid] : (spans[mid - 1] + spans[mid]) / 2;
  return Math.floor(median / DAY_MS);
}

/** A shop's derived dispatch time (storefront-themes D9, org-profile Q19): never typed, null with no data. */
export async function dispatchDaysForOrg(orgId: string): Promise<number | null> {
  const since = new Date(Date.now() - DISPATCH_WINDOW_DAYS * DAY_MS);
  const times = await readyTimesForOrg(orgId, PAYMENT_STATUS.PAID, [ORDER_STATUS.CANCELLED, ORDER_STATUS.EXPIRED], since, DISPATCH_SAMPLE);
  return medianDispatchDays(times);
}
